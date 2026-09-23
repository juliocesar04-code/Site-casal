import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/server/payments/service";
import { hitLimit } from "@/server/security/rate-limit";
import { clientIp, ipHash } from "@/server/security/request";

export const maxDuration = 30;

const MAX_BODY = 64 * 1024;

// Authenticity comes from the HMAC signature, not from the origin; CSRF
// checks do not apply here. Every decision is re-read from the provider.
export async function POST(request: Request) {
  if (!(await hitLimit("webhook", ipHash(await clientIp())))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });

  try {
    const result = await handlePaymentWebhook(request, raw);
    if (result === "invalid") return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    return NextResponse.json({ received: true });
  } catch (error) {
    // 5xx makes the provider retry; processing is idempotent.
    console.error("webhook processing failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
