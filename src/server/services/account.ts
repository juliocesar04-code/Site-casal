import "server-only";
import { createAdminClient, createUserClient } from "@/server/db/clients";
import type { SessionUser } from "@/server/auth/session";
import { logEvent, logSecurityEvent } from "@/server/security/log";
import { processStorageDeletions } from "@/server/services/maintenance";

// LGPD data portability: everything the user authored, as JSON.
export async function exportAccountData(user: SessionUser): Promise<Record<string, unknown>> {
  const db = await createUserClient();
  const [profile, memories, sections, timeline, contributions, responses, payments] = await Promise.all([
    db.from("profiles").select("display_name, locale, created_at").maybeSingle(),
    db.from("memories").select(
      "id, status, template_id, theme, occasion, title, recipient_name, sender_name, opening_line, message, closing_line, release_at, content_hash, published_at, created_at",
    ),
    db.from("memory_sections").select("memory_id, title, body, event_date, position"),
    db.from("memory_timeline").select("memory_id, event_date, title, body, position"),
    db.from("memory_contributions").select("memory_id, author_name, body, status, created_at"),
    db.from("recipient_responses").select("memory_id, author_name, body, created_at"),
    db.from("payments").select("memory_id, product_id, amount_cents, currency, status, method, approved_at, created_at"),
  ]);

  return {
    exported_at: new Date().toISOString(),
    account: { email: user.email, ...(profile.data ?? {}) },
    memories: memories.data ?? [],
    chapters: sections.data ?? [],
    timeline: timeline.data ?? [],
    contributions: contributions.data ?? [],
    responses: responses.data ?? [],
    payments: payments.data ?? [],
    note: "Fotos e vídeos podem ser baixados abrindo cada memória.",
  };
}

export async function deleteAccount(user: SessionUser): Promise<void> {
  const db = await createUserClient();
  const { data } = await db.from("memories").select("id");
  for (const memory of (data ?? []) as { id: string }[]) {
    await db.rpc("delete_memory", { p_memory_id: memory.id });
  }

  await logEvent("account_deleted", { actorId: user.id });
  await logSecurityEvent("account_deleted", "info", { userId: user.id });

  // Cascades remove profile, tombstones and notifications; payments keep only
  // the fiscal record with the owner reference cleared.
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) throw new Error("account deletion failed");
  await processStorageDeletions(500);
}
