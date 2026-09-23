import "server-only";
import { createAdminClient } from "@/server/db/clients";
import { logSecurityEvent } from "@/server/security/log";

export const LIMITS = {
  login: { limit: 8, window: 900 },
  loginEmail: { limit: 5, window: 900 },
  signup: { limit: 5, window: 3600 },
  passwordReset: { limit: 3, window: 3600 },
  uploadSlot: { limit: 80, window: 3600 },
  draftWrite: { limit: 600, window: 600 },
  checkout: { limit: 10, window: 3600 },
  contribution: { limit: 6, window: 3600 },
  contributionView: { limit: 60, window: 600 },
  response: { limit: 5, window: 3600 },
  publicMemory: { limit: 120, window: 600 },
  analytics: { limit: 120, window: 600 },
  webhook: { limit: 300, window: 60 },
  linkCreate: { limit: 20, window: 3600 },
} as const;

export type LimitName = keyof typeof LIMITS;

export class RateLimitError extends Error {}

// Fails closed: if the limiter itself errors, the request is refused.
export async function hitLimit(name: LimitName, key: string): Promise<boolean> {
  const { limit, window } = LIMITS[name];
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_bucket: `${name}:${key}`,
    p_limit: limit,
    p_window_seconds: window,
  });
  if (error) {
    console.error("rate limiter unavailable", error.code);
    return false;
  }
  if (data !== true) {
    await logSecurityEvent("rate_limited", "warning", { meta: { limit: name } });
    return false;
  }
  return true;
}

export async function enforceLimit(name: LimitName, key: string): Promise<void> {
  if (!(await hitLimit(name, key))) throw new RateLimitError(name);
}
