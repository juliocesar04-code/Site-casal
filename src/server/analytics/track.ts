import "server-only";
import { z } from "zod";
import { TEMPLATE_IDS, THEME_IDS } from "@/domain/presets";
import { createAdminClient } from "@/server/db/clients";

export const ANALYTICS_EVENTS = [
  "landing_view",
  "create_started",
  "draft_created",
  "template_selected",
  "photo_uploaded",
  "preview_opened",
  "checkout_started",
  "payment_success",
  "memory_published",
  "memory_opened",
  "experience_completed",
  "share_clicked",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

// Only coarse, non-identifying properties are accepted. No ids, names, text,
// slugs or URLs ever reach the analytics table.
export const analyticsPropsSchema = z
  .object({
    template: z.enum(TEMPLATE_IDS),
    theme: z.enum(THEME_IDS),
    channel: z.enum(["copy", "whatsapp", "telegram", "native", "qr"]),
    viewport: z.enum(["mobile", "desktop"]),
  })
  .partial()
  .strict();

export async function track(name: AnalyticsEvent, props: z.infer<typeof analyticsPropsSchema> = {}): Promise<void> {
  await createAdminClient().from("analytics_events").insert({ name, props });
}
