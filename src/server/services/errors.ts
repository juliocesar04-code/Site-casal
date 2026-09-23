// Errors that are safe to show. Anything else is logged and surfaced as a
// generic failure, so internal details never reach the client.
export type ServiceErrorCode =
  | "not_found"
  | "not_editable"
  | "incomplete"
  | "uploads_in_progress"
  | "limit_reached"
  | "rate_limited"
  | "invalid_input"
  | "invalid_file"
  | "file_too_large"
  | "video_too_long"
  | "payments_unavailable"
  | "closed"
  | "unauthorized";

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode) {
    super(code);
  }
}

export function fromDatabaseError(error: { code?: string; message?: string } | null): ServiceError | null {
  if (!error) return null;
  const message = error.message ?? "";
  if (message.includes("limit_reached") || message.includes("draft_limit_reached")) return new ServiceError("limit_reached");
  if (message.includes("incomplete")) return new ServiceError("incomplete");
  if (message.includes("uploads_in_progress")) return new ServiceError("uploads_in_progress");
  if (message.includes("release_too_far")) return new ServiceError("invalid_input");
  if (message.includes("memory_frozen") || message.includes("memory_deleted")) return new ServiceError("not_editable");
  if (message.includes("closed")) return new ServiceError("closed");
  if (error.code === "P0002" || message.includes("not_found")) return new ServiceError("not_found");
  if (error.code === "23514" || error.code === "22001") return new ServiceError("invalid_input");
  return null;
}
