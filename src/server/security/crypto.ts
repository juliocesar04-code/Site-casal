import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Rejection sampling keeps every character equally likely.
export function randomBase62(length: number): string {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < 248) out += BASE62[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

export function sha256(input: string | Buffer): Buffer {
  return createHash("sha256").update(input).digest();
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function derivedKey(purpose: string): Buffer {
  return createHmac("sha256", env().APP_SECRET).update(purpose).digest();
}

export function hmacHex(purpose: string, data: string): string {
  return createHmac("sha256", derivedKey(purpose)).update(data).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Compact signed ticket: base64url(payload).signature. Used to bind a follow-up
// request (upload completion) to what the server authorised a moment earlier.
export function signTicket(purpose: string, payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }))
    .toString("base64url");
  return `${body}.${hmacHex(purpose, body)}`;
}

export function verifyTicket(purpose: string, ticket: string): Record<string, unknown> | null {
  const [body, signature] = ticket.split(".");
  if (!body || !signature || !safeEqual(signature, hmacHex(purpose, body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
