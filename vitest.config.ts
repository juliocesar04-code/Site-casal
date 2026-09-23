import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real package throws outside a React Server Components bundle.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: {
      APP_URL: "https://relicario.test",
      APP_SECRET: "test-secret-with-enough-length-0123456789",
      SUPABASE_URL: "https://project.supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key-000",
      SUPABASE_SECRET_KEY: "test-secret-key-0000000000",
      MERCADOPAGO_WEBHOOK_SECRET: "webhook-secret-for-tests",
      MERCADOPAGO_ACCESS_TOKEN: "TEST-token-0000",
    },
  },
});
