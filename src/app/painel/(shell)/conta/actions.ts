"use server";

import { redirect } from "next/navigation";
import { t } from "@/lib/i18n";
import { userOrThrow } from "@/server/auth/session";
import { createUserClient } from "@/server/db/clients";
import { deleteAccount } from "@/server/services/account";

export async function deleteAccountAction(_previous: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const user = await userOrThrow();
  if (String(form.get("confirmation") ?? "").trim().toUpperCase() !== t.delete.confirmWord) {
    return { error: t.errors.invalid_input };
  }
  try {
    await deleteAccount(user);
  } catch {
    return { error: t.errors.generic };
  }
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/");
}
