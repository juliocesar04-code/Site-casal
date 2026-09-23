import "server-only";
import { createAdminClient, createUserClient } from "@/server/db/clients";
import { env } from "@/server/env";
import { t } from "@/lib/i18n";

export type NotificationType =
  | "payment_confirmed"
  | "memory_published"
  | "memory_scheduled"
  | "memory_released"
  | "contribution_received"
  | "response_received";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  memory_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(): Promise<NotificationItem[]> {
  const db = await createUserClient();
  const { data } = await db
    .from("notifications")
    .select("id, type, memory_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as NotificationItem[];
}

export async function markNotificationsRead(): Promise<void> {
  const db = await createUserClient();
  await db.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
}

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY || !EMAIL_FROM) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

// Emails carry no memory content, only a pointer back to the dashboard.
export async function deliverPendingEmails(limit = 50): Promise<number> {
  const { RESEND_API_KEY, APP_URL } = env();
  if (!RESEND_API_KEY) return 0;

  const admin = createAdminClient();
  const { data } = await admin
    .from("notifications")
    .select("id, user_id, type, memory_id")
    .is("emailed_at", null)
    .gt("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
    .order("created_at")
    .limit(limit);

  let sent = 0;
  for (const item of (data ?? []) as { id: string; user_id: string; type: NotificationType; memory_id: string | null }[]) {
    const { data: user } = await admin.auth.admin.getUserById(item.user_id);
    const address = user.user?.email;
    const copy = t.notifications.email[item.type];
    const link = item.memory_id ? `${APP_URL}/painel/memorias/${item.memory_id}` : `${APP_URL}/painel`;

    if (address && (await sendEmail(address, copy.subject, `${copy.body}\n\n${link}\n\n${t.notifications.email.footer}`))) {
      sent++;
    }
    await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", item.id);
  }
  return sent;
}
