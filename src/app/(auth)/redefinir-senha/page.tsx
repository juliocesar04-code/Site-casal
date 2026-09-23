import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetForm } from "@/components/auth/auth-forms";
import { t } from "@/lib/i18n";
import { currentUser } from "@/server/auth/session";
import { resetPasswordAction } from "../actions";

export const metadata: Metadata = { title: t.auth.reset.title, robots: { index: false } };

export default async function ResetPasswordPage() {
  // Only reachable with the session created by the recovery link.
  if (!(await currentUser())) redirect("/entrar?erro=link");

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-5xl">{t.auth.reset.title}</h1>
        <p className="text-ink-2">{t.auth.reset.lead}</p>
      </div>
      <ResetForm action={resetPasswordAction} />
    </div>
  );
}
