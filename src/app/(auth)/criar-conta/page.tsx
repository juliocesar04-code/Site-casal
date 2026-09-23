import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/auth-forms";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { currentUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { googleSignInAction, signUpAction } from "../actions";

export const metadata: Metadata = { title: t.auth.signUp.title };

export default async function SignUpPage() {
  if (await currentUser()) redirect("/painel");

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-5xl">{t.auth.signUp.title}</h1>
        <p className="text-ink-2">{t.auth.signUp.lead}</p>
      </div>

      {env().AUTH_GOOGLE_ENABLED ? (
        <>
          <form action={googleSignInAction}>
            <input type="hidden" name="next" value="/painel" />
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              {t.auth.signIn.google}
            </Button>
          </form>
          <div className="flex items-center gap-4 text-xs text-muted" aria-hidden="true">
            <span className="rule flex-1" />
            {t.auth.or}
            <span className="rule flex-1" />
          </div>
        </>
      ) : null}

      <SignUpForm action={signUpAction} />

      <p className="text-sm text-ink-2">
        {t.auth.signUp.hasAccount}{" "}
        <Link href="/entrar" className="font-medium text-ink underline underline-offset-4">
          {t.auth.signUp.signIn}
        </Link>
      </p>
    </div>
  );
}
