import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/security/request";
import { contributionContext } from "@/server/services/collaboration";
import { ServiceError } from "@/server/services/errors";
import { completeUpload } from "@/server/services/media";

export const maxDuration = 60;

const body = z.object({ ticket: z.string().min(10).max(1024) });

export async function POST(request: Request, { params }: RouteContext<"/api/contribuir/[token]/complete">) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    const input = body.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

    // The link must still be open and point at the memory the ticket was issued for.
    const context = await contributionContext(token);
    if (context.state !== "open") throw new ServiceError(context.state === "closed" ? "closed" : "not_found");

    await completeUpload(input.data.ticket, (_owner, memoryId) => memoryId === context.memoryId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
