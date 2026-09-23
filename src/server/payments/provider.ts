import "server-only";

export type CheckoutRequest = {
  paymentId: string;
  memoryId: string;
  product: { id: string; title: string; amountCents: number; currency: string };
  payerEmail: string | null;
  returnUrl: string;
  notificationUrl: string;
};

export type Checkout = {
  checkoutId: string;
  url: string;
};

export type ProviderPaymentStatus = "approved" | "pending" | "rejected" | "cancelled" | "refunded";

// Normalised view of a payment as reported by the provider's own API.
export type ProviderPayment = {
  providerPaymentId: string;
  reference: string | null;
  status: ProviderPaymentStatus;
  amountCents: number;
  currency: string;
  method: string | null;
};

export type WebhookNotification = {
  eventKey: string;
  providerPaymentId: string | null;
};

export interface PaymentProvider {
  readonly name: "mercadopago";
  createCheckout(request: CheckoutRequest): Promise<Checkout>;
  // Returns null when the signature or payload is not trustworthy.
  parseWebhook(request: Request, rawBody: string): WebhookNotification | null;
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment | null>;
}
