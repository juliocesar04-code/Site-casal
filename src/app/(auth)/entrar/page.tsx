import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/auth-forms";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/redirect";
import { t } from "@/lib/i18n";
import { currentUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { googleSignInAction, signInAction } from "../actions";

export const metadata: Metadata = { title: t.auth.signIn.title };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  if (await currentUser()) redirect(next);

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-5xl">{t.auth.signIn.title}</h1>
        <p className="text-ink-2">{t.auth.signIn.lead}</p>
      </div>

      {params.erro ? (
        <p role="alert" className="rounded-lg bg-danger/8 px-4 py-3 text-sm text-danger">
          {t.auth.errors.linkExpired}
        </p>
      ) : null}

      {env().AUTH_GOOGLE_ENABLED ? (
        <>
          <form action={googleSignInAction}>
            <input type="hidden" name="next" value={next} />
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

      <SignInForm action={signInAction} next={next} />

      <p className="text-sm text-ink-2">
        {t.auth.signIn.noAccount}{" "}
        <Link href="/criar-conta" className="font-medium text-ink underline underline-offset-4">
          {t.auth.signIn.create}
        </Link>
      </p>
    </div>
  );
}
