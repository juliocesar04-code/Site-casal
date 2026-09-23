import { NextResponse } from "next/server";
import { z } from "zod";
import { ANALYTICS_EVENTS, analyticsPropsSchema, track } from "@/server/analytics/track";
import { hitLimit } from "@/server/security/rate-limit";
import { clientIp, ipHash, isSameOrigin } from "@/server/security/request";

// Events that only the server may record (payments, publication) are not
// accepted from the browser.
const CLIENT_EVENTS = ANALYTICS_EVENTS.filter(
  (name) => !["payment_success", "memory_published", "draft_created"].includes(name),
) as [string, ...string[]];

const body = z.object({ name: z.enum(CLIENT_EVENTS), props: analyticsPropsSchema.default({}) });

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return new NextResponse(null, { status: 204 });
  const raw = await request.text();
  if (raw.length > 2048) return new NextResponse(null, { status: 204 });

  const parsed = body.safeParse((() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })());
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  if (!(await hitLimit("analytics", ipHash(await clientIp())))) return new NextResponse(null, { status: 204 });

  await track(parsed.data.name as (typeof ANALYTICS_EVENTS)[number], parsed.data.props);
  return new NextResponse(null, { status: 204 });
}
