import "server-only";
import { createAdminClient } from "@/server/db/clients";

export const MEDIA_BUCKET = "media";
const SIGNED_READ_SECONDS = 60 * 60 * 2;

// Paths are always built here from server-generated UUIDs; nothing a client
// sends ever becomes part of a storage key.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function mediaPath(memoryId: string, mediaId: string, file: "source" | "poster-source" | string): string {
  if (!UUID.test(memoryId) || !UUID.test(mediaId) || !/^[a-z-]+(\.[a-z0-9]+)?$/.test(file)) {
    throw new Error("invalid media path component");
  }
  return `${memoryId}/${mediaId}/${file}`;
}

function bucket() {
  return createAdminClient().storage.from(MEDIA_BUCKET);
}

export async function createUploadUrl(path: string): Promise<string> {
  const { data, error } = await bucket().createSignedUploadUrl(path);
  if (error || !data) throw new Error(`signed upload failed: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

export async function downloadObject(path: string, maxBytes: number): Promise<Buffer | null> {
  const { data, error } = await bucket().download(path);
  if (error || !data) return null;
  if (data.size > maxBytes) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function putObject(path: string, body: Buffer, contentType: string): Promise<void> {
  const { error } = await bucket().upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function removeObjects(paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await bucket().remove(paths);
  return !error;
}

export async function signReadUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;

  const { data, error } = await bucket().createSignedUrls(unique, SIGNED_READ_SECONDS);
  if (error || !data) return urls;
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
