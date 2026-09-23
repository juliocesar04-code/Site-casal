import "server-only";
import { createAdminClient } from "@/server/db/clients";
import { MEDIA_BUCKET, removeObjects } from "@/server/storage/media-storage";

// Drains the queue filled by the memory_media delete trigger.
export async function processStorageDeletions(limit = 100): Promise<number> {
  const db = createAdminClient();
  const { data } = await db
    .from("storage_deletions")
    .select("id, bucket, path, attempts")
    .eq("bucket", MEDIA_BUCKET)
    .lt("attempts", 10)
    .order("id")
    .limit(limit);

  const rows = (data ?? []) as { id: number; path: string; attempts: number }[];
  if (rows.length === 0) return 0;

  if (await removeObjects(rows.map((row) => row.path))) {
    await db.from("storage_deletions").delete().in("id", rows.map((row) => row.id));
    return rows.length;
  }

  await Promise.all(
    rows.map((row) =>
      db.from("storage_deletions").update({ attempts: row.attempts + 1, last_error: "remove_failed" }).eq("id", row.id),
    ),
  );
  return 0;
}

// Uploads that were never completed (tab closed, network drop). Signed upload
// URLs live for two hours, so anything older cannot finish anymore.
export async function sweepStaleUploads(): Promise<number> {
  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data } = await createAdminClient()
    .from("memory_media")
    .delete()
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  return data?.length ?? 0;
}
