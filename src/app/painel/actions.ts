"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { uuid } from "@/lib/validation/schemas";
import { t } from "@/lib/i18n";
import { userOrThrow } from "@/server/auth/session";
import { markNotificationsRead } from "@/server/notifications/outbox";
import { RateLimitError } from "@/server/security/rate-limit";
import { ServiceError } from "@/server/services/errors";
import { createDraft, deleteMemory } from "@/server/services/memories";
import { track } from "@/server/analytics/track";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createMemoryAction(form: FormData): Promise<void> {
  const user = await userOrThrow();
  let id: string;
  try {
    id = await createDraft(user, form.get("template"));
  } catch (error) {
    if (error instanceof ServiceError || error instanceof RateLimitError) redirect("/painel?erro=limite");
    throw error;
  }
  await track("draft_created");
  redirect(`/painel/memorias/${id}`);
}

export async function deleteMemoryAction(memoryId: string, confirmation: string): Promise<ActionResult> {
  await userOrThrow();
  if (!uuid.safeParse(memoryId).success) return { ok: false, error: "not_found" };
  if (confirmation.trim().toUpperCase() !== t.delete.confirmWord) return { ok: false, error: "invalid_input" };

  try {
    await deleteMemory(memoryId);
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, error: error.code };
    throw error;
  }
  revalidatePath("/painel");
  return { ok: true };
}

export async function readNotificationsAction(): Promise<void> {
  await userOrThrow();
  await markNotificationsRead();
  revalidatePath("/painel");
}
