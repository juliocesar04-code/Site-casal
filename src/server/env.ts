import "server-only";
import { z } from "zod";

const schema = z.object({
  APP_URL: z.url().transform((url) => url.replace(/\/$/, "")),
  APP_SECRET: z.string().min(32, "APP_SECRET must have at least 32 characters"),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(10).optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(10).optional(),
  CRON_SECRET: z.string().min(24).optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  CONTACT_EMAIL: z.email().optional(),
  AUTH_GOOGLE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Parsed lazily so `next build` does not need production secrets; the first
// request fails loudly if anything required is missing.
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Invalid environment configuration: ${fields}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function paymentsConfigured(): boolean {
  const { MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET } = env();
  return Boolean(MERCADOPAGO_ACCESS_TOKEN && MERCADOPAGO_WEBHOOK_SECRET);
}
