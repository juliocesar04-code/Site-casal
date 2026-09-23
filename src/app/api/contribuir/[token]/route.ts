import { NextResponse } from "next/server";
import { contributionSchema } from "@/lib/validation/schemas";
import { errorResponse } from "@/server/http/errors";
import { assertSameOrigin, clientIp, ipHash } from "@/server/security/request";
import { submitContribution } from "@/server/services/collaboration";

export async function POST(request: Request, { params }: RouteContext<"/api/contribuir/[token]">) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    const input = contributionSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

    const media = input.data.media;
    if (media && !(media.kind === "image" ? media.mime.startsWith("image/") : media.mime.startsWith("video/"))) {
      return NextResponse.json({ error: "invalid_file" }, { status: 400 });
    }

    const result = await submitContribution(token, ipHash(await clientIp()), {
      author: input.data.author,
      body: input.data.body,
      media: media ? { kind: media.kind } : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
