import "server-only";
import { createAdminClient } from "@/server/db/clients";

type Severity = "info" | "warning" | "critical";

type Context = {
  userId?: string | null;
  ipHash?: string | null;
  path?: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

// Structured, content-free security trail. Never pass message bodies, tokens,
// cookies, signed URLs or raw IPs in `meta`.
export async function logSecurityEvent(type: string, severity: Severity, context: Context = {}): Promise<void> {
  const { error } = await createAdminClient()
    .from("security_events")
    .insert({
      type,
      severity,
      user_id: context.userId ?? null,
      ip_hash: context.ipHash ?? null,
      path: context.path?.slice(0, 200) ?? null,
      meta: context.meta ?? {},
    });
  if (error) console.error("security log write failed", type, error.code);
  if (severity === "critical") console.error("security event", type);
}

export async function logEvent(
  action: string,
  context: { actorId?: string | null; memoryId?: string | null; meta?: Record<string, string | number | boolean> },
): Promise<void> {
  const { error } = await createAdminClient()
    .from("event_logs")
    .insert({
      action,
      actor_id: context.actorId ?? null,
      memory_id: context.memoryId ?? null,
      meta: context.meta ?? {},
    });
  if (error) console.error("event log write failed", action, error.code);
}
