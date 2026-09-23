"use server";

import { responseSchema, slug as slugSchema } from "@/lib/validation/schemas";
import { clientIp, ipHash } from "@/server/security/request";
import { RateLimitError } from "@/server/security/rate-limit";
import { ServiceError } from "@/server/services/errors";
import { submitResponse } from "@/server/services/responses";

export type ResponseState = { status: "idle" | "sent" | "error"; error?: string };

export async function respondAction(slug: string, _previous: ResponseState, form: FormData): Promise<ResponseState> {
  const parsedSlug = slugSchema.safeParse(slug);
  const parsed = responseSchema.safeParse({ author: form.get("author") ?? "", body: form.get("body") ?? "" });
  if (!parsedSlug.success || !parsed.success) return { status: "error", error: "invalid_input" };

  try {
    await submitResponse(parsedSlug.data, ipHash(await clientIp()), parsed.data);
    return { status: "sent" };
  } catch (error) {
    if (error instanceof RateLimitError) return { status: "error", error: "rate_limited" };
    if (error instanceof ServiceError) return { status: "error", error: error.code };
    console.error("response failed");
    return { status: "error", error: "generic" };
  }
}
