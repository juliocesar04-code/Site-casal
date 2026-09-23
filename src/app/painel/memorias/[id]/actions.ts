"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  collaborationLinkSchema,
  mediaPatchSchema,
  memoryPatchSchema,
  reorderSchema,
  sectionSchema,
  timelineSchema,
  uuid,
} from "@/lib/validation/schemas";
import { userOrThrow, UnauthorizedError } from "@/server/auth/session";
import { track } from "@/server/analytics/track";
import { startCheckout } from "@/server/payments/service";
import { RateLimitError } from "@/server/security/rate-limit";
import { createCollaborationLink, revokeCollaborationLink } from "@/server/services/collaboration";
import { ServiceError } from "@/server/services/errors";
import {
  addChild,
  deleteChild,
  reorderChildren,
  returnToDraft,
  saveMemoryFields,
  setContributionStatus,
  updateChild,
} from "@/server/services/memories";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.code };
    if (error instanceof RateLimitError) return { ok: false, error: "rate_limited" };
    if (error instanceof UnauthorizedError) return { ok: false, error: "unauthorized" };
    if (error instanceof z.ZodError) return { ok: false, error: "invalid_input" };
    console.error("editor action failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "generic" };
  }
}

export async function saveFieldsAction(memoryId: string, patch: unknown): Promise<Result<string>> {
  return run(async () => {
    const user = await userOrThrow();
    return saveMemoryFields(user, uuid.parse(memoryId), memoryPatchSchema.parse(patch));
  });
}

const childTable = z.enum(["memory_sections", "memory_timeline"]);
const orderTable = z.enum(["memory_sections", "memory_timeline", "memory_media"]);

export async function addChildAction(table: string, memoryId: string): Promise<Result<string>> {
  return run(async () => addChild(await userOrThrow(), childTable.parse(table), uuid.parse(memoryId)));
}

export async function updateSectionAction(id: string, patch: unknown): Promise<Result> {
  return run(async () => {
    await updateChild(await userOrThrow(), "memory_sections", uuid.parse(id), sectionSchema.parse(patch));
    return null;
  });
}

export async function updateTimelineAction(id: string, patch: unknown): Promise<Result> {
  return run(async () => {
    await updateChild(await userOrThrow(), "memory_timeline", uuid.parse(id), timelineSchema.parse(patch));
    return null;
  });
}

export async function updateMediaAction(id: string, patch: unknown): Promise<Result> {
  return run(async () => {
    await updateChild(await userOrThrow(), "memory_media", uuid.parse(id), mediaPatchSchema.parse(patch));
    return null;
  });
}

export async function deleteItemAction(table: string, id: string): Promise<Result> {
  return run(async () => {
    await deleteChild(await userOrThrow(), orderTable.parse(table), uuid.parse(id));
    return null;
  });
}

export async function reorderAction(table: string, memoryId: string, ids: unknown): Promise<Result> {
  return run(async () => {
    await reorderChildren(await userOrThrow(), orderTable.parse(table), uuid.parse(memoryId), reorderSchema.parse(ids));
    return null;
  });
}

export async function contributionStatusAction(id: string, status: string): Promise<Result> {
  return run(async () => {
    await setContributionStatus(await userOrThrow(), uuid.parse(id), z.enum(["approved", "rejected", "pending"]).parse(status));
    return null;
  });
}

export async function createLinkAction(memoryId: string, input: unknown): Promise<Result<string>> {
  return run(async () => {
    const user = await userOrThrow();
    const url = await createCollaborationLink(user, uuid.parse(memoryId), collaborationLinkSchema.parse(input));
    revalidatePath(`/painel/memorias/${memoryId}`);
    return url;
  });
}

export async function revokeLinkAction(memoryId: string, linkId: string): Promise<Result> {
  return run(async () => {
    await revokeCollaborationLink(await userOrThrow(), uuid.parse(linkId));
    revalidatePath(`/painel/memorias/${memoryId}`);
    return null;
  });
}

export async function checkoutAction(
  memoryId: string,
  confirmed: boolean,
): Promise<Result<{ kind: "redirect"; url: string } | { kind: "published" }>> {
  return run(async () => {
    // The review checkbox is a UX gate; the database freeze is the real guarantee.
    if (confirmed !== true) throw new ServiceError("invalid_input");
    const user = await userOrThrow();
    const outcome = await startCheckout(user, uuid.parse(memoryId));
    await track("checkout_started");
    revalidatePath("/painel");
    return outcome;
  });
}

export async function returnToDraftAction(memoryId: string): Promise<Result> {
  return run(async () => {
    await returnToDraft(await userOrThrow(), uuid.parse(memoryId));
    revalidatePath(`/painel/memorias/${memoryId}`);
    return null;
  });
}
