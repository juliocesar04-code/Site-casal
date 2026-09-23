import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient, createUserClient } from "@/server/db/clients";
import type { SessionUser } from "@/server/auth/session";
import { detectMime, type AllowedMime } from "@/server/media/detect";
import { processImage } from "@/server/media/image";
import { ALLOWED_VIDEO_CODECS, inspectMp4 } from "@/server/media/mp4";
import { sha256Hex, signTicket, verifyTicket } from "@/server/security/crypto";
import { logSecurityEvent } from "@/server/security/log";
import { enforceLimit } from "@/server/security/rate-limit";
import { createUploadUrl, downloadObject, mediaPath, putObject, removeObjects, signReadUrls } from "@/server/storage/media-storage";
import { fromDatabaseError, ServiceError } from "@/server/services/errors";
import { UPLOAD_LIMITS } from "@/lib/validation/schemas";

export type UploadSlot = {
  mediaId: string;
  uploadUrl: string;
  posterUploadUrl: string | null;
  ticket: string;
};

export type ReadyMedia = {
  id: string;
  kind: "image" | "video";
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
};

const TICKET_TTL = 2 * 60 * 60;
const ticketSchema = z.object({ mediaId: z.uuid(), memoryId: z.uuid(), owner: z.string() });

type SlotInput = {
  memoryId: string;
  kind: "image" | "video";
  sectionId: string | null;
  contributionId?: string | null;
};

// Shared by owners (owner = user id) and contributors (owner = contribution id).
async function createSlot(input: SlotInput, owner: string): Promise<UploadSlot> {
  const mediaId = randomUUID();
  const sourcePath = mediaPath(input.memoryId, mediaId, "source");

  const { error } = await createAdminClient()
    .from("memory_media")
    .insert({
      id: mediaId,
      memory_id: input.memoryId,
      section_id: input.sectionId,
      contribution_id: input.contributionId ?? null,
      kind: input.kind,
      status: "pending",
      storage_path: sourcePath,
      position: 999,
    });
  const known = fromDatabaseError(error);
  if (known) throw known;
  if (error) throw new Error(error.message);

  const [uploadUrl, posterUploadUrl] = await Promise.all([
    createUploadUrl(sourcePath),
    input.kind === "video" ? createUploadUrl(mediaPath(input.memoryId, mediaId, "poster-source")) : null,
  ]);

  return {
    mediaId,
    uploadUrl,
    posterUploadUrl,
    ticket: signTicket("upload", { mediaId, memoryId: input.memoryId, owner }, TICKET_TTL),
  };
}

export async function requestOwnerUpload(
  user: SessionUser,
  input: { memoryId: string; kind: "image" | "video"; sectionId: string | null },
): Promise<UploadSlot> {
  await enforceLimit("uploadSlot", user.id);

  // Ownership and draft state are checked with the user's own client (RLS).
  const db = await createUserClient();
  const { data: memory } = await db
    .from("memories")
    .select("id, status")
    .eq("id", input.memoryId)
    .maybeSingle();
  if (!memory) throw new ServiceError("not_found");
  if (memory.status !== "draft") throw new ServiceError("not_editable");

  if (input.sectionId) {
    const { data: section } = await db
      .from("memory_sections")
      .select("id")
      .eq("id", input.sectionId)
      .eq("memory_id", input.memoryId)
      .maybeSingle();
    if (!section) throw new ServiceError("not_found");
  }

  return createSlot(input, user.id);
}

export async function requestContributorUpload(input: {
  memoryId: string;
  contributionId: string;
  kind: "image" | "video";
}): Promise<UploadSlot> {
  return createSlot({ ...input, sectionId: null }, input.contributionId);
}

type Rejection = "invalid_file" | "file_too_large" | "video_too_long";

async function reject(mediaId: string, reason: Rejection, path: string): Promise<never> {
  // Deleting the row queues every object under it for removal.
  await createAdminClient().from("memory_media").delete().eq("id", mediaId);
  await logSecurityEvent("upload_rejected", "warning", { path, meta: { reason } });
  throw new ServiceError(reason);
}

// `authorize` receives what the server signed when the slot was created and
// must confirm it matches the caller (the signed-in owner, or the memory the
// contributor's link points to).
export async function completeUpload(
  ticket: string,
  authorize: (owner: string, memoryId: string) => boolean,
): Promise<ReadyMedia> {
  const parsed = ticketSchema.safeParse(verifyTicket("upload", ticket));
  if (!parsed.success || !authorize(parsed.data.owner, parsed.data.memoryId)) throw new ServiceError("unauthorized");
  const { mediaId, memoryId } = parsed.data;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("memory_media")
    .select("id, kind, status, memory_id, memories!inner(status)")
    .eq("id", mediaId)
    .eq("memory_id", memoryId)
    .maybeSingle();

  const media = row as { id: string; kind: "image" | "video"; status: string; memories: { status: string } } | null;
  if (!media) throw new ServiceError("not_found");
  if (media.status === "ready") return describe(mediaId);
  if (media.memories.status !== "draft") throw new ServiceError("not_editable");

  const sourcePath = mediaPath(memoryId, mediaId, "source");
  const limit = media.kind === "image" ? UPLOAD_LIMITS.image.maxBytes : UPLOAD_LIMITS.video.maxBytes;
  const source = await downloadObject(sourcePath, limit);
  if (!source) return reject(mediaId, "file_too_large", "/api/uploads/complete");

  const mime = detectMime(source);
  const cleanup: string[] = [sourcePath];
  let update: Record<string, unknown>;

  if (media.kind === "image") {
    if (!mime || !mime.startsWith("image/")) return reject(mediaId, "invalid_file", "/api/uploads/complete");
    const processed = await processImage(source, formatOf(mime));
    if (!processed) return reject(mediaId, "invalid_file", "/api/uploads/complete");

    const mainPath = mediaPath(memoryId, mediaId, "image.webp");
    const thumbPath = mediaPath(memoryId, mediaId, "thumb.webp");
    await Promise.all([
      putObject(mainPath, processed.main, "image/webp"),
      putObject(thumbPath, processed.thumb, "image/webp"),
    ]);

    update = {
      storage_path: mainPath,
      thumb_path: thumbPath,
      mime: "image/webp",
      bytes: processed.main.length,
      width: processed.width,
      height: processed.height,
      checksum: sha256Hex(processed.main),
    };
  } else {
    if (mime !== "video/mp4" && mime !== "video/quicktime") return reject(mediaId, "invalid_file", "/api/uploads/complete");
    const info = inspectMp4(source);
    if (!info || (info.videoCodec && !ALLOWED_VIDEO_CODECS.has(info.videoCodec))) {
      return reject(mediaId, "invalid_file", "/api/uploads/complete");
    }
    if (info.durationMs > UPLOAD_LIMITS.video.maxDurationMs) {
      return reject(mediaId, "video_too_long", "/api/uploads/complete");
    }

    // QuickTime files with H.264/HEVC are ISO-BMFF; browsers play them as MP4.
    const videoPath = mediaPath(memoryId, mediaId, "video.mp4");
    await putObject(videoPath, source, "video/mp4");

    let posterPath: string | null = null;
    let thumbPath: string | null = null;
    const posterSourcePath = mediaPath(memoryId, mediaId, "poster-source");
    cleanup.push(posterSourcePath);
    const posterSource = await downloadObject(posterSourcePath, UPLOAD_LIMITS.poster.maxBytes);
    const posterMime = posterSource ? detectMime(posterSource) : null;
    if (posterSource && posterMime?.startsWith("image/")) {
      const poster = await processImage(posterSource, formatOf(posterMime));
      if (poster) {
        posterPath = mediaPath(memoryId, mediaId, "poster.webp");
        thumbPath = mediaPath(memoryId, mediaId, "thumb.webp");
        await Promise.all([
          putObject(posterPath, poster.main, "image/webp"),
          putObject(thumbPath, poster.thumb, "image/webp"),
        ]);
      }
    }

    update = {
      storage_path: videoPath,
      poster_path: posterPath,
      thumb_path: thumbPath,
      mime: "video/mp4",
      bytes: source.length,
      width: info.width,
      height: info.height,
      duration_ms: info.durationMs,
      checksum: sha256Hex(source),
    };
  }

  const { error } = await admin
    .from("memory_media")
    .update({ ...update, status: "ready" })
    .eq("id", mediaId)
    .eq("status", "pending");
  if (error) {
    // The memory left draft while we were processing: discard the upload.
    await admin.from("memory_media").delete().eq("id", mediaId);
    throw fromDatabaseError(error) ?? new Error(error.message);
  }

  await removeObjects(cleanup);
  return describe(mediaId);
}

function formatOf(mime: AllowedMime): "jpeg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpeg";
}

async function describe(mediaId: string): Promise<ReadyMedia> {
  const { data } = await createAdminClient()
    .from("memory_media")
    .select("id, kind, thumb_path, width, height")
    .eq("id", mediaId)
    .single();
  const row = data as { id: string; kind: "image" | "video"; thumb_path: string | null; width: number | null; height: number | null };
  const urls = row.thumb_path ? await signReadUrls([row.thumb_path]) : new Map<string, string>();
  return {
    id: row.id,
    kind: row.kind,
    thumbUrl: row.thumb_path ? (urls.get(row.thumb_path) ?? null) : null,
    width: row.width,
    height: row.height,
  };
}
