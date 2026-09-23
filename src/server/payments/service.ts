import "server-only";
import { DEFAULT_PRODUCT, PRODUCTS } from "@/domain/catalog";
import { createAdminClient, createUserClient } from "@/server/db/clients";
import { env, paymentsConfigured } from "@/server/env";
import type { SessionUser } from "@/server/auth/session";
import { mercadoPago } from "@/server/payments/mercadopago";
import type { PaymentProvider } from "@/server/payments/provider";
import { logEvent, logSecurityEvent } from "@/server/security/log";
import { enforceLimit } from "@/server/security/rate-limit";
import { fromDatabaseError, ServiceError } from "@/server/services/errors";

const provider: PaymentProvider = mercadoPago;

export type CheckoutOutcome = { kind: "redirect"; url: string } | { kind: "published" };

export async function startCheckout(user: SessionUser, memoryId: string): Promise<CheckoutOutcome> {
  await enforceLimit("checkout", user.id);

  const db = await createUserClient();
  const { data } = await db.from("memories").select("id, status, paid_payment_id").eq("id", memoryId).maybeSingle();
  const memory = data as { id: string; status: string; paid_payment_id: string | null } | null;
  if (!memory) throw new ServiceError("not_found");
  if (memory.status !== "draft" && memory.status !== "awaiting_payment") throw new ServiceError("not_editable");
  if (!memory.paid_payment_id && !paymentsConfigured()) throw new ServiceError("payments_unavailable");

  // Freezes the content that was just reviewed. From here on the database
  // refuses edits until the owner explicitly returns to draft.
  if (memory.status === "draft") {
    const { error } = await db.rpc("submit_for_payment", { p_memory_id: memoryId });
    const known = fromDatabaseError(error);
    if (known) throw known;
    if (error) throw new Error(error.message);
  }

  const admin = createAdminClient();

  if (memory.paid_payment_id) {
    const { error } = await admin.rpc("publish_with_credit", { p_memory_id: memoryId });
    if (error) throw new Error(error.message);
    await logEvent("memory_published_with_credit", { actorId: user.id, memoryId });
    return { kind: "published" };
  }

  const product = PRODUCTS[DEFAULT_PRODUCT];
  const { data: payment, error: insertError } = await admin
    .from("payments")
    .insert({
      memory_id: memoryId,
      owner_id: user.id,
      provider: provider.name,
      product_id: product.id,
      amount_cents: product.amountCents,
      currency: product.currency,
    })
    .select("id")
    .single();
  if (insertError || !payment) throw new Error("payment record failed");

  const { APP_URL } = env();
  const checkout = await provider.createCheckout({
    paymentId: payment.id as string,
    memoryId,
    product,
    payerEmail: user.email,
    returnUrl: `${APP_URL}/painel/memorias/${memoryId}/publicada`,
    notificationUrl: `${APP_URL}/api/webhooks/mercadopago`,
  });

  await admin.from("payments").update({ provider_checkout_id: checkout.checkoutId }).eq("id", payment.id);
  await logEvent("checkout_started", { actorId: user.id, memoryId, meta: { payment_id: payment.id as string } });

  return { kind: "redirect", url: checkout.url };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type WebhookResult = "processed" | "ignored" | "invalid";

export async function handlePaymentWebhook(request: Request, rawBody: string): Promise<WebhookResult> {
  const notification = provider.parseWebhook(request, rawBody);
  if (!notification) {
    await logSecurityEvent("webhook_invalid_signature", "warning", { path: "/api/webhooks/mercadopago" });
    return "invalid";
  }

  const admin = createAdminClient();
  const { error: duplicate } = await admin.from("payment_events").insert({
    provider: provider.name,
    event_key: notification.eventKey,
    provider_payment_id: notification.providerPaymentId,
  });
  if (duplicate?.code === "23505") {
    // Delivered before. Skip only if that attempt finished; a crash mid-way
    // leaves no outcome and the provider's retry must be processed again.
    // Everything below is idempotent, so concurrent retries are harmless.
    const { data: previous } = await admin
      .from("payment_events")
      .select("outcome")
      .eq("provider", provider.name)
      .eq("event_key", notification.eventKey)
      .maybeSingle();
    if (previous?.outcome) return "ignored";
  } else if (duplicate) {
    throw new Error(duplicate.message);
  }

  if (!notification.providerPaymentId) {
    await recordOutcome(notification.eventKey, "not_a_payment");
    return "ignored";
  }

  // The notification body is never trusted; the provider API is the source of truth.
  const payment = await provider.fetchPayment(notification.providerPaymentId);
  if (!payment || !payment.reference || !UUID.test(payment.reference)) {
    await recordOutcome(notification.eventKey, "unknown_payment");
    return "ignored";
  }

  const { data: local } = await admin
    .from("payments")
    .select("id, provider")
    .eq("id", payment.reference)
    .maybeSingle();
  if (!local || local.provider !== provider.name) {
    await logSecurityEvent("webhook_unknown_reference", "warning", { meta: { provider_payment_id: payment.providerPaymentId } });
    await recordOutcome(notification.eventKey, "unknown_reference");
    return "ignored";
  }

  if (payment.status === "approved") {
    const { data, error } = await admin.rpc("record_payment_approval", {
      p_payment_id: payment.reference,
      p_provider_payment_id: payment.providerPaymentId,
      p_amount_cents: payment.amountCents,
      p_currency: payment.currency,
      p_method: payment.method,
    });
    if (error) {
      await recordOutcome(notification.eventKey, error.message.includes("amount_mismatch") ? "amount_mismatch" : "error");
      if (error.message.includes("amount_mismatch")) return "processed";
      throw new Error(error.message);
    }
    await recordOutcome(notification.eventKey, String((data as { outcome?: string })?.outcome ?? "approved"));
    return "processed";
  }

  const { error } = await admin.rpc("record_payment_status", {
    p_payment_id: payment.reference,
    p_status: payment.status,
    p_provider_payment_id: payment.providerPaymentId,
  });
  if (error) throw new Error(error.message);
  await recordOutcome(notification.eventKey, payment.status);
  return "processed";
}

async function recordOutcome(eventKey: string, outcome: string): Promise<void> {
  await createAdminClient()
    .from("payment_events")
    .update({ outcome: outcome.slice(0, 60) })
    .eq("provider", provider.name)
    .eq("event_key", eventKey);
}
