import { NextResponse } from "next/server";
import { z } from "zod";
import { userOrThrow } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/request";
import { completeUpload } from "@/server/services/media";
import { track } from "@/server/analytics/track";
import { errorResponse } from "@/server/http/errors";

export const maxDuration = 60;

const body = z.object({ ticket: z.string().min(10).max(1024) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await userOrThrow();
    const input = body.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

    // The ticket was issued to this user; a ticket copied from someone else fails here.
    const media = await completeUpload(input.data.ticket, (owner) => owner === user.id);
    if (media.kind === "image") await track("photo_uploaded");
    return NextResponse.json(media);
  } catch (error) {
    return errorResponse(error);
  }
}
