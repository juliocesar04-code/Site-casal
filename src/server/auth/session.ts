import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createUserClient } from "@/server/db/clients";

export type SessionUser = {
  id: string;
  email: string | null;
};

// getUser() revalidates the JWT with Supabase Auth instead of trusting the
// cookie contents, so a forged or revoked session is rejected here.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  return user;
}

export class UnauthorizedError extends Error {}

// For route handlers and actions, where redirecting is not the right answer.
export async function userOrThrow(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
