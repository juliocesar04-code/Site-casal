import "server-only";
import { headers } from "next/headers";
import { env } from "@/server/env";
import { hmacHex } from "@/server/security/crypto";

// Vercel overwrites x-forwarded-for with the real client address, so the first
// entry is trustworthy there. Elsewhere it is only used for rate-limit keys.
export function clientIpFrom(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "0.0.0.0";
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

// IPs are never stored in clear text.
export function ipHash(ip: string): string {
  return hmacHex("ip", ip).slice(0, 32);
}

export function isSameOrigin(h: Headers): boolean {
  const origin = h.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(env().APP_URL).origin;
  } catch {
    return false;
  }
}

export class OriginError extends Error {}

export function assertSameOrigin(request: Request): void {
  if (!isSameOrigin(request.headers)) throw new OriginError("cross-origin request rejected");
}
