import { NextResponse } from "next/server";
import { createAdminClient } from "@/server/db/clients";
import { env } from "@/server/env";
import { deliverPendingEmails } from "@/server/notifications/outbox";
import { safeEqual } from "@/server/security/crypto";
import { processStorageDeletions, sweepStaleUploads } from "@/server/services/maintenance";

export const maxDuration = 60;

// Called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`. The
// database releases scheduled memories on its own (pg_cron); this is the
// fallback plus the housekeeping that needs the storage API.
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [released, stale] = await Promise.all([
    admin.rpc("release_due_memories").then((r) => (r.data as number | null) ?? 0),
    sweepStaleUploads(),
  ]);
  const deleted = await processStorageDeletions(500);
  const emailed = await deliverPendingEmails(100);

  return NextResponse.json({ released, stale, deleted, emailed });
}
