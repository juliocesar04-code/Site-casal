import type { Metadata } from "next";
import { AccountDeletion } from "@/components/dashboard/account-deletion";
import { buttonClass } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { deleteAccountAction } from "./actions";

export const metadata: Metadata = { title: t.account.title };

export default async function AccountPage() {
  const user = await requireUser("/painel/conta");

  return (
    <main className="mx-auto grid max-w-2xl gap-12 px-4 py-12 sm:px-6">
      <div className="grid gap-2">
        <h1 className="font-display text-5xl">{t.account.title}</h1>
        <p className="text-ink-2">
          {t.account.email}: {user.email}
        </p>
      </div>

      <section className="grid gap-4 rounded-2xl border border-line bg-card p-6">
        <h2 className="font-display text-3xl">{t.account.export.title}</h2>
        <p className="leading-relaxed text-ink-2">{t.account.export.body}</p>
        <a href="/api/conta/exportar" className={buttonClass("secondary", "md", "justify-self-start")}>
          {t.account.export.action}
        </a>
      </section>

      <section className="grid gap-4 rounded-2xl border border-danger/30 bg-card p-6">
        <h2 className="font-display text-3xl">{t.account.delete.title}</h2>
        <p className="leading-relaxed text-ink-2">{t.account.delete.body}</p>
        <AccountDeletion action={deleteAccountAction} />
      </section>
    </main>
  );
}
