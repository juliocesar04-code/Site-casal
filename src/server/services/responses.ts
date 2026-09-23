import "server-only";
import { createAdminClient } from "@/server/db/clients";
import { sha256Hex } from "@/server/security/crypto";
import { enforceLimit } from "@/server/security/rate-limit";
import { fromDatabaseError, ServiceError } from "@/server/services/errors";

// Stored apart from the memory; the published snapshot and its hash never change.
export async function submitResponse(slug: string, ipKey: string, input: { author: string; body: string }): Promise<void> {
  if (!/^[0-9A-Za-z]{14}$/.test(slug)) throw new ServiceError("not_found");
  await enforceLimit("response", ipKey);
  await enforceLimit("response", `slug:${sha256Hex(slug).slice(0, 16)}`);

  const { error } = await createAdminClient().rpc("submit_response", {
    p_slug: slug,
    p_author: input.author,
    p_body: input.body,
  });
  if (error) throw fromDatabaseError(error) ?? new Error("response failed");
}
