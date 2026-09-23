import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { env } from "@/server/env";
import { safeEqual } from "@/server/security/crypto";
import type {
  Checkout,
  CheckoutRequest,
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentStatus,
  WebhookNotification,
} from "@/server/payments/provider";

const API = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 10_000;

// Notifications are verified by signature and then re-read from the API, and
// processing is idempotent, so a replayed notification cannot change anything.
// The window only bounds how long a captured request stays usable.
const SIGNATURE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const preferenceResponse = z.object({ id: z.string(), init_point: z.url() });

const paymentResponse = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  external_reference: z.string().nullable().optional(),
  transaction_amount: z.number(),
  currency_id: z.string(),
  payment_type_id: z.string().nullable().optional(),
});

function token(): string {
  const value = env().MERCADOPAGO_ACCESS_TOKEN;
  if (!value) throw new Error("Mercado Pago is not configured");
  return value;
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
}

function mapStatus(status: string): ProviderPaymentStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "refunded":
    case "charged_back":
      return "refunded";
    default:
      return "pending";
  }
}

// https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
export function verifyMercadoPagoSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
  now?: number;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = input;
  if (!signatureHeader || !requestId || !dataId) return false;

  const parts = new Map(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key?.trim() ?? "", rest.join("=").trim()] as const;
    }),
  );
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/.test(v1)) return false;

  const tsMs = ts.length > 11 ? Number(ts) : Number(ts) * 1000;
  if (Math.abs((input.now ?? Date.now()) - tsMs) > SIGNATURE_MAX_AGE_MS) return false;

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqual(expected, v1);
}

export const mercadoPago: PaymentProvider = {
  name: "mercadopago",

  async createCheckout(request: CheckoutRequest): Promise<Checkout> {
    const response = await call("/checkout/preferences", {
      method: "POST",
      headers: { "X-Idempotency-Key": request.paymentId },
      body: JSON.stringify({
        items: [
          {
            id: request.product.id,
            title: request.product.title,
            quantity: 1,
            currency_id: request.product.currency,
            unit_price: request.product.amountCents / 100,
          },
        ],
        external_reference: request.paymentId,
        notification_url: request.notificationUrl,
        back_urls: { success: request.returnUrl, pending: request.returnUrl, failure: request.returnUrl },
        auto_return: "approved",
        statement_descriptor: "RELICARIO",
        binary_mode: false,
        payer: request.payerEmail ? { email: request.payerEmail } : undefined,
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
          installments: 1,
        },
        expires: true,
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    if (!response.ok) throw new Error(`checkout creation failed with status ${response.status}`);
    const parsed = preferenceResponse.parse(await response.json());
    return { checkoutId: parsed.id, url: parsed.init_point };
  },

  parseWebhook(request: Request, rawBody: string): WebhookNotification | null {
    const secret = env().MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) return null;

    const url = new URL(request.url);
    let body: { type?: unknown; data?: { id?: unknown } } = {};
    try {
      body = rawBody ? (JSON.parse(rawBody) as typeof body) : {};
    } catch {
      return null;
    }

    const type = url.searchParams.get("type") ?? (typeof body.type === "string" ? body.type : null);
    const dataId = url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);
    const requestId = request.headers.get("x-request-id");

    const valid = verifyMercadoPagoSignature({
      signatureHeader: request.headers.get("x-signature"),
      requestId,
      dataId,
      secret,
    });
    if (!valid || !requestId) return null;

    return {
      eventKey: `${type ?? "unknown"}:${dataId}:${requestId}`.slice(0, 200),
      providerPaymentId: type === "payment" && dataId && /^\d{1,20}$/.test(dataId) ? dataId : null,
    };
  },

  async fetchPayment(providerPaymentId: string): Promise<ProviderPayment | null> {
    if (!/^\d{1,20}$/.test(providerPaymentId)) return null;
    const response = await call(`/v1/payments/${providerPaymentId}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`payment lookup failed with status ${response.status}`);

    const parsed = paymentResponse.parse(await response.json());
    return {
      providerPaymentId: parsed.id,
      reference: parsed.external_reference ?? null,
      status: mapStatus(parsed.status),
      amountCents: Math.round(parsed.transaction_amount * 100),
      currency: parsed.currency_id,
      method: parsed.payment_type_id ?? null,
    };
  },
};
