type EventName =
  | "landing_view"
  | "create_started"
  | "template_selected"
  | "photo_uploaded"
  | "preview_opened"
  | "checkout_started"
  | "memory_opened"
  | "experience_completed"
  | "share_clicked";

type Props = Partial<{
  template: string;
  theme: string;
  channel: "copy" | "whatsapp" | "telegram" | "native" | "qr";
  viewport: "mobile" | "desktop";
}>;

// Fire-and-forget; analytics must never affect the experience.
export function track(name: EventName, props: Props = {}): void {
  try {
    const body = JSON.stringify({ name, props });
    const sent = navigator.sendBeacon?.("/api/analytics", new Blob([body], { type: "application/json" }));
    if (!sent) void fetch("/api/analytics", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  } catch {
    // ignored on purpose
  }
}
