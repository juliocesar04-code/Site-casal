"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { email, newPassword } from "@/lib/validation/schemas";
import { line } from "@/lib/validation/text";
import { safeRedirectPath } from "@/lib/redirect";
import { createUserClient } from "@/server/db/clients";
import { env } from "@/server/env";
import { logSecurityEvent } from "@/server/security/log";
import { hitLimit } from "@/server/security/rate-limit";
import { clientIp, ipHash } from "@/server/security/request";
import { sha256Hex } from "@/server/security/crypto";

export type AuthState = { status: "idle" | "error" | "sent"; message?: string; email?: string };

const credentials = z.object({ email, password: z.string().min(1).max(128) });

export async function signInAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { status: "error", message: "invalid" };

  const ip = ipHash(await clientIp());
  const emailKey = sha256Hex(parsed.data.email).slice(0, 24);
  if (!(await hitLimit("login", ip)) || !(await hitLimit("loginEmail", emailKey))) {
    return { status: "error", message: "rateLimited" };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await logSecurityEvent("login_failed", "info", { ipHash: ip, path: "/entrar" });
    return { status: "error", message: error.code === "email_not_confirmed" ? "unconfirmed" : "invalid" };
  }

  redirect(safeRedirectPath(form.get("next")));
}

const signUp = z.object({ name: line(80), email, password: newPassword });

export async function signUpAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signUp.safeParse({ name: form.get("name") ?? "", email: form.get("email"), password: form.get("password") });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { status: "error", message: field === "password" ? "weakPassword" : field === "email" ? "invalidEmail" : "generic" };
  }

  if (!(await hitLimit("signup", ipHash(await clientIp())))) return { status: "error", message: "rateLimited" };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env().APP_URL}/auth/confirm?next=/painel`,
      data: parsed.data.name ? { full_name: parsed.data.name } : undefined,
    },
  });

  if (error && error.code === "weak_password") return { status: "error", message: "weakPassword" };
  if (error && error.status !== 422 && error.code !== "user_already_exists") {
    console.error("signup failed", error.code);
    return { status: "error", message: "generic" };
  }

  // Same answer whether or not the address already has an account.
  return { status: "sent", email: parsed.data.email };
}

export async function forgotPasswordAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", message: "invalidEmail" };

  const ip = ipHash(await clientIp());
  if (!(await hitLimit("passwordReset", ip)) || !(await hitLimit("passwordReset", sha256Hex(parsed.data).slice(0, 24)))) {
    return { status: "error", message: "rateLimited" };
  }

  const supabase = await createUserClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env().APP_URL}/auth/confirm?next=/redefinir-senha`,
  });
  return { status: "sent" };
}

export async function resetPasswordAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const parsed = newPassword.safeParse(form.get("password"));
  if (!parsed.success) return { status: "error", message: "weakPassword" };

  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "error", message: "linkExpired" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { status: "error", message: error.code === "weak_password" ? "weakPassword" : "generic" };

  // Other devices keep no access with the old password.
  await supabase.auth.signOut({ scope: "others" });
  await logSecurityEvent("password_changed", "info", { userId: data.user.id });
  redirect("/painel");
}

export async function googleSignInAction(form: FormData): Promise<void> {
  if (!env().AUTH_GOOGLE_ENABLED) redirect("/entrar");
  const next = safeRedirectPath(form.get("next"));
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env().APP_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url || !data.url.startsWith("https://")) redirect("/entrar?erro=oauth");
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/");
}
