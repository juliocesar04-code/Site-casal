import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEMORY_STATUSES, canTransition } from "@/domain/memory-status";
import { safeRedirectPath } from "@/lib/redirect";
import { cleanLine, cleanText } from "@/lib/validation/text";
import { memoryPatchSchema, uploadRequestSchema } from "@/lib/validation/schemas";
import { verifyMercadoPagoSignature, mercadoPago } from "@/server/payments/mercadopago";
import { buildCsp } from "@/server/security/csp";
import { randomBase62, signTicket, verifyTicket } from "@/server/security/crypto";
import { isSameOrigin } from "@/server/security/request";

describe("safeRedirectPath", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "%2F%2Fevil.example",
    "%252F%252Fevil.example",
    "javascript:alert(1)",
    "/%0d%0aSet-Cookie:x",
    "",
    "painel",
    null,
    42,
  ])("rejects %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/painel");
  });

  it("keeps internal paths", () => {
    expect(safeRedirectPath("/painel/memorias/1?etapa=2")).toBe("/painel/memorias/1?etapa=2");
    expect(safeRedirectPath("/")).toBe("/");
  });
});

describe("text normalisation", () => {
  it("removes bidi overrides and control characters", () => {
    expect(cleanLine("Ana‮gnp.exe")).toBe("Anagnp.exe");
    expect(cleanText("a\u0000b\u0007c")).toBe("abc");
    expect(cleanText("  linha 1\r\nlinha 2  ")).toBe("linha 1\nlinha 2");
  });

  it("keeps text as text", () => {
    expect(cleanText("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
  });
});

describe("schemas", () => {
  it("rejects unknown and protected fields in a memory patch", () => {
    expect(memoryPatchSchema.safeParse({ status: "published" }).success).toBe(false);
    expect(memoryPatchSchema.safeParse({ owner_id: "x" }).success).toBe(false);
    expect(memoryPatchSchema.safeParse({ content_hash: "x" }).success).toBe(false);
    expect(memoryPatchSchema.safeParse({ title: "a".repeat(121) }).success).toBe(false);
    expect(memoryPatchSchema.safeParse({ theme: "hacker" }).success).toBe(false);
    expect(memoryPatchSchema.safeParse({ title: "Dez anos" }).success).toBe(true);
  });

  it("only accepts release dates in the future and within five years", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const far = new Date(Date.now() + 6 * 365 * 86_400_000).toISOString();
    const soon = new Date(Date.now() + 86_400_000).toISOString();
    expect(memoryPatchSchema.safeParse({ release_at: past }).success).toBe(false);
    expect(memoryPatchSchema.safeParse({ release_at: far }).success).toBe(false);
    expect(memoryPatchSchema.safeParse({ release_at: soon }).success).toBe(true);
  });

  it("limits upload requests by type and size", () => {
    const memoryId = "c0000000-0000-4000-8000-000000000001";
    expect(uploadRequestSchema.safeParse({ kind: "image", memoryId, mime: "image/svg+xml", size: 10 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ kind: "image", memoryId, mime: "image/png", size: 16 * 1024 * 1024 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ kind: "video", memoryId, mime: "image/png", size: 10 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ kind: "image", memoryId: "../../x", mime: "image/png", size: 10 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ kind: "image", memoryId, mime: "image/png", size: 10 }).success).toBe(true);
  });
});

describe("memory state machine", () => {
  it("matches the transitions enforced by the database", () => {
    const sql = readFileSync("supabase/migrations/20260923000200_integrity.sql", "utf8");
    const block = sql.slice(sql.indexOf("any (array["), sql.indexOf("]);", sql.indexOf("any (array[")));
    const database = new Set([...block.matchAll(/'(\w+)>(\w+)'/g)].map((m) => `${m[1]}>${m[2]}`));

    const local = new Set<string>();
    for (const from of MEMORY_STATUSES) for (const to of MEMORY_STATUSES) if (canTransition(from, to)) local.add(`${from}>${to}`);
    expect(local).toEqual(database);
  });

  it("never leaves a published memory except by deletion", () => {
    expect(MEMORY_STATUSES.filter((to) => canTransition("published", to))).toEqual(["deleted"]);
    expect(MEMORY_STATUSES.filter((to) => canTransition("deleted", to))).toEqual([]);
  });
});

describe("tokens and tickets", () => {
  it("generates unbiased base62 of the requested length", () => {
    const token = randomBase62(22);
    expect(token).toMatch(/^[0-9A-Za-z]{22}$/);
    const counts = new Map<string, number>();
    for (const char of randomBase62(62_000)) counts.set(char, (counts.get(char) ?? 0) + 1);
    expect(counts.size).toBe(62);
    for (const count of counts.values()) expect(count).toBeGreaterThan(700);
  });

  it("verifies, rejects tampering and expires", () => {
    const ticket = signTicket("upload", { mediaId: "m", owner: "a" }, 60);
    expect(verifyTicket("upload", ticket)).toMatchObject({ mediaId: "m", owner: "a" });
    expect(verifyTicket("other-purpose", ticket)).toBeNull();

    const [body, sig] = ticket.split(".");
    const forged = Buffer.from(JSON.stringify({ mediaId: "m", owner: "b", exp: 9_999_999_999 })).toString("base64url");
    expect(verifyTicket("upload", `${forged}.${sig}`)).toBeNull();
    expect(verifyTicket("upload", `${body}.${"0".repeat(64)}`)).toBeNull();
    expect(verifyTicket("upload", signTicket("upload", { mediaId: "m" }, -1))).toBeNull();
    expect(verifyTicket("upload", "garbage")).toBeNull();
  });
});

describe("Mercado Pago webhook signature", () => {
  const secret = "webhook-secret-for-tests";
  const sign = (id: string, requestId: string, ts: string) =>
    createHmac("sha256", secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest("hex");

  it("accepts a correctly signed notification", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(
      verifyMercadoPagoSignature({ signatureHeader: `ts=${ts},v1=${sign("123", "req-1", ts)}`, requestId: "req-1", dataId: "123", secret }),
    ).toBe(true);
  });

  it("rejects wrong secret, altered id, missing parts and stale timestamps", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const v1 = sign("123", "req-1", ts);
    expect(verifyMercadoPagoSignature({ signatureHeader: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "124", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ signatureHeader: `ts=${ts},v1=${v1}`, requestId: "req-2", dataId: "123", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ signatureHeader: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "123", secret: "other" })).toBe(false);
    expect(verifyMercadoPagoSignature({ signatureHeader: `v1=${v1}`, requestId: "req-1", dataId: "123", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ signatureHeader: null, requestId: "req-1", dataId: "123", secret })).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3 * 86_400);
    expect(
      verifyMercadoPagoSignature({ signatureHeader: `ts=${old},v1=${sign("123", "req-1", old)}`, requestId: "req-1", dataId: "123", secret }),
    ).toBe(false);
  });

  it("parses only signed payment notifications", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signed = new Request("https://relicario.test/api/webhooks/mercadopago?data.id=987&type=payment", {
      method: "POST",
      headers: { "x-request-id": "r1", "x-signature": `ts=${ts},v1=${sign("987", "r1", ts)}` },
    });
    expect(mercadoPago.parseWebhook(signed, JSON.stringify({ type: "payment", data: { id: "987" } }))).toMatchObject({
      providerPaymentId: "987",
    });

    const unsigned = new Request("https://relicario.test/api/webhooks/mercadopago?data.id=987&type=payment", {
      method: "POST",
      headers: { "x-request-id": "r1" },
    });
    expect(mercadoPago.parseWebhook(unsigned, "{}")).toBeNull();
  });
});

describe("request origin", () => {
  it("only trusts the application origin", () => {
    expect(isSameOrigin(new Headers({ origin: "https://relicario.test" }))).toBe(true);
    expect(isSameOrigin(new Headers({ origin: "https://relicario.test.evil.com" }))).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "null" }))).toBe(false);
    expect(isSameOrigin(new Headers())).toBe(false);
  });
});

describe("content security policy", () => {
  it("is strict in production", () => {
    const csp = buildCsp({ nonce: "abc", supabaseOrigin: "https://x.supabase.co", allowSameOriginFrame: false, dev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  it("only relaxes framing for the preview frame", () => {
    expect(buildCsp({ nonce: "a", supabaseOrigin: null, allowSameOriginFrame: true, dev: false })).toContain("frame-ancestors 'self'");
  });
});
