import { NextResponse } from "next/server";
import { uploadRequestSchema } from "@/lib/validation/schemas";
import { userOrThrow } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/security/request";
import { requestOwnerUpload } from "@/server/services/media";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await userOrThrow();
    const input = uploadRequestSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

    const slot = await requestOwnerUpload(user, {
      memoryId: input.data.memoryId,
      kind: input.data.kind,
      sectionId: input.data.sectionId,
    });
    return NextResponse.json(slot);
  } catch (error) {
    return errorResponse(error);
  }
}
