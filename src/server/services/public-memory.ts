import "server-only";
import { z } from "zod";
import { collectMedia, snapshotSchema, toViewMemory, type ViewMemory } from "@/domain/snapshot";
import { createAdminClient } from "@/server/db/clients";
import { logSecurityEvent } from "@/server/security/log";
import { signReadUrls } from "@/server/storage/media-storage";

export type PublicMemory =
  | { state: "not_found" }
  | { state: "scheduled"; releaseAt: string; recipient: string | null; serverNow: string }
  | {
      state: "open";
      memoryId: string;
      memory: ViewMemory;
      hash: string;
      publishedAt: string;
      intact: boolean;
    };

const rpcResult = z.discriminatedUnion("state", [
  z.object({ state: z.literal("not_found") }),
  z.object({
    state: z.literal("scheduled"),
    release_at: z.string(),
    recipient: z.string().nullable(),
    server_now: z.string(),
  }),
  z.object({
    state: z.literal("open"),
    memory_id: z.uuid(),
    snapshot: z.unknown(),
    hash: z.string(),
    published_at: z.string(),
    intact: z.boolean(),
  }),
]);

export async function loadPublicMemory(slug: string): Promise<PublicMemory> {
  if (!/^[0-9A-Za-z]{14}$/.test(slug)) return { state: "not_found" };

  const { data, error } = await createAdminClient().rpc("get_public_memory", { p_slug: slug });
  if (error) throw new Error("public memory lookup failed");

  const result = rpcResult.parse(data);
  if (result.state === "not_found") return result;
  if (result.state === "scheduled") {
    return {
      state: "scheduled",
      releaseAt: result.release_at,
      recipient: result.recipient,
      serverNow: result.server_now,
    };
  }

  const snapshot = snapshotSchema.safeParse(result.snapshot);
  if (!snapshot.success || !result.intact) {
    await logSecurityEvent("integrity_check_failed", "critical", { meta: { memory_id: result.memory_id } });
    return { state: "not_found" };
  }

  const paths = collectMedia(snapshot.data).flatMap((media) => [media.path, ...(media.poster ? [media.poster] : [])]);
  const urls = await signReadUrls(paths);

  return {
    state: "open",
    memoryId: result.memory_id,
    memory: toViewMemory(snapshot.data, urls),
    hash: result.hash,
    publishedAt: result.published_at,
    intact: result.intact,
  };
}
