// Prices live on the server side of every flow: the client only ever sends a
// memory id, and the checkout resolves the amount from here.
export const PRODUCTS = {
  memory_standard: {
    id: "memory_standard",
    title: "Relicário · memória digital",
    amountCents: 999,
    currency: "BRL",
  },
} as const;

export type ProductId = keyof typeof PRODUCTS;

export const DEFAULT_PRODUCT: ProductId = "memory_standard";

export function formatPrice(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}
