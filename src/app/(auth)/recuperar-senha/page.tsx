import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/auth-forms";
import { t } from "@/lib/i18n";
import { forgotPasswordAction } from "../actions";

export const metadata: Metadata = { title: t.auth.forgot.title };

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-5xl">{t.auth.forgot.title}</h1>
        <p className="text-ink-2">{t.auth.forgot.lead}</p>
      </div>
      <ForgotForm action={forgotPasswordAction} />
      <Link href="/entrar" className="text-sm text-ink-2 underline underline-offset-4">
        {t.auth.forgot.back}
      </Link>
    </div>
  );
}
