import "server-only";
import { z } from "zod";
import { createAdminClient, createUserClient } from "@/server/db/clients";
import type { SessionUser } from "@/server/auth/session";
import { randomBase62, sha256 } from "@/server/security/crypto";
import { enforceLimit } from "@/server/security/rate-limit";
import { requestContributorUpload, type UploadSlot } from "@/server/services/media";
import { fromDatabaseError, ServiceError } from "@/server/services/errors";
import { env } from "@/server/env";

const TOKEN_LENGTH = 22;
const MAX_CONTRIBUTOR_MEDIA = 20;

// PostgREST expects bytea as \x-prefixed hex.
function tokenHash(token: string): string {
  return `\\x${sha256(token).toString("hex")}`;
}

export function isTokenShape(token: string): boolean {
  return new RegExp(`^[0-9A-Za-z]{${TOKEN_LENGTH}}$`).test(token);
}

export async function createCollaborationLink(
  user: SessionUser,
  memoryId: string,
  input: { label: string; expiresInDays: number },
): Promise<string> {
  await enforceLimit("linkCreate", user.id);
  const token = randomBase62(TOKEN_LENGTH);
  const expiresAt = input.expiresInDays > 0 ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null;

  const db = await createUserClient();
  const { data, error } = await db
    .from("collaboration_links")
    .insert({
      memory_id: memoryId,
      token_hash: tokenHash(token),
      label: input.label || null,
      expires_at: expiresAt,
    })
    .select("id");

  const known = fromDatabaseError(error);
  if (known) throw known;
  if (error || !data?.length) throw new ServiceError("not_editable");

  // The token is shown once; only its hash is stored.
  return `${env().APP_URL}/contribuir/${token}`;
}

export async function revokeCollaborationLink(user: SessionUser, linkId: string): Promise<void> {
  await enforceLimit("draftWrite", user.id);
  const db = await createUserClient();
  const { data } = await db
    .from("collaboration_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("revoked_at", null)
    .select("id");
  if (!data?.length) throw new ServiceError("not_found");
}

const contextSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("invalid") }),
  z.object({ state: z.literal("closed") }),
  z.object({
    state: z.literal("open"),
    link_id: z.uuid(),
    memory_id: z.uuid(),
    recipient: z.string().nullable(),
    sender: z.string().nullable(),
  }),
]);

export type ContributionContext =
  | { state: "invalid" | "closed" }
  | { state: "open"; memoryId: string; recipient: string | null; sender: string | null };

export async function contributionContext(token: string): Promise<ContributionContext> {
  if (!isTokenShape(token)) return { state: "invalid" };
  const { data, error } = await createAdminClient().rpc("contribution_context", { p_token_hash: tokenHash(token) });
  if (error) throw new Error("contribution context failed");
  const parsed = contextSchema.parse(data);
  if (parsed.state !== "open") return { state: parsed.state };
  return { state: "open", memoryId: parsed.memory_id, recipient: parsed.recipient, sender: parsed.sender };
}

export async function submitContribution(
  token: string,
  ipKey: string,
  input: { author: string; body: string; media: { kind: "image" | "video" } | null },
): Promise<{ upload: UploadSlot | null }> {
  if (!isTokenShape(token)) throw new ServiceError("not_found");
  await enforceLimit("contribution", ipKey);
  await enforceLimit("contribution", `token:${sha256(token).toString("hex").slice(0, 16)}`);

  const { data, error } = await createAdminClient().rpc("submit_contribution", {
    p_token_hash: tokenHash(token),
    p_author: input.author,
    p_body: input.body,
  });
  if (error) {
    if (error.message.includes("invalid_link")) throw new ServiceError("not_found");
    throw fromDatabaseError(error) ?? new Error("contribution failed");
  }

  const result = z.object({ contribution_id: z.uuid(), memory_id: z.uuid() }).parse(data);
  if (!input.media) return { upload: null };

  const { count } = await createAdminClient()
    .from("memory_media")
    .select("id", { count: "exact", head: true })
    .eq("memory_id", result.memory_id)
    .not("contribution_id", "is", null);
  if ((count ?? 0) >= MAX_CONTRIBUTOR_MEDIA) return { upload: null };

  return {
    upload: await requestContributorUpload({
      memoryId: result.memory_id,
      contributionId: result.contribution_id,
      kind: input.media.kind,
    }),
  };
}
