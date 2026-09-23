"use client";

export type UploadedMedia = {
  id: string;
  kind: "image" | "video";
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
};

export class UploadError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 45 * 1024 * 1024;
const MAX_DURATION = 60;
const MAX_EDGE = 3000;

export function kindOf(file: File): "image" | "video" | null {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

// Large photos are scaled down before upload to save the visitor's data plan.
// The server re-encodes everything anyway; this is only about bandwidth.
async function shrinkImage(file: File): Promise<Blob> {
  if (file.size < 2.5 * 1024 * 1024 || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function inspectVideo(file: File): Promise<{ duration: number; poster: Blob | null }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new UploadError("invalid_file"));
    });
    const duration = video.duration;
    video.currentTime = Math.min(0.5, duration / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      window.setTimeout(resolve, 3000);
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
    canvas.width = Math.round((video.videoWidth || 1280) * scale);
    canvas.height = Math.round((video.videoHeight || 720) * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return { duration, poster };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function put(url: string, body: Blob, type: string): Promise<void> {
  const response = await fetch(url, { method: "PUT", body, headers: { "content-type": type, "x-upsert": "false" } });
  if (!response.ok) throw new UploadError("generic");
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new UploadError(data.error ?? "generic");
  return data;
}

type Slot = { mediaId: string; uploadUrl: string; posterUploadUrl: string | null; ticket: string };

type Endpoints = {
  // Returns an upload slot for a file of the given kind and size.
  requestSlot: (input: { kind: "image" | "video"; mime: string; size: number }) => Promise<Slot>;
  completePath: string;
};

export async function uploadFile(file: File, endpoints: Endpoints): Promise<UploadedMedia> {
  const kind = kindOf(file);
  if (!kind) throw new UploadError("invalid_file");

  let body: Blob = file;
  let poster: Blob | null = null;

  if (kind === "image") {
    body = await shrinkImage(file);
    if (body.size > MAX_IMAGE) throw new UploadError("file_too_large");
  } else {
    if (file.size > MAX_VIDEO) throw new UploadError("file_too_large");
    const info = await inspectVideo(file);
    if (info.duration > MAX_DURATION + 0.5) throw new UploadError("video_too_long");
    poster = info.poster;
  }

  const mime = body === file ? file.type : "image/jpeg";
  const slot = await endpoints.requestSlot({ kind, mime, size: body.size });
  await put(slot.uploadUrl, body, mime);
  if (poster && slot.posterUploadUrl) await put(slot.posterUploadUrl, poster, "image/jpeg").catch(() => undefined);
  return postJson<UploadedMedia>(endpoints.completePath, { ticket: slot.ticket });
}

export function ownerEndpoints(memoryId: string, sectionId: string | null): Endpoints {
  return {
    requestSlot: (input) => postJson<Slot>("/api/uploads", { ...input, memoryId, sectionId }),
    completePath: "/api/uploads/complete",
  };
}
