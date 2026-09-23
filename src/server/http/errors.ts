import "server-only";
import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/server/auth/session";
import { RateLimitError } from "@/server/security/rate-limit";
import { OriginError } from "@/server/security/request";
import { ServiceError } from "@/server/services/errors";

// Maps known failures to stable codes; anything else becomes a bare 500.
export function errorResponse(error: unknown) {
  if (error instanceof OriginError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (error instanceof RateLimitError) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (error instanceof ServiceError) {
    const status = error.code === "not_found" ? 404 : error.code === "unauthorized" ? 403 : 422;
    return NextResponse.json({ error: error.code }, { status });
  }
  console.error("route failed", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: "generic" }, { status: 500 });
}
