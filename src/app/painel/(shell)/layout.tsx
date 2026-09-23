import Link from "next/link";
import { NotificationsMenu } from "@/components/dashboard/notifications-menu";
import { Logo } from "@/components/ui/logo";
import { t } from "@/lib/i18n";
import { listNotifications } from "@/server/notifications/outbox";
import { signOutAction } from "../../(auth)/actions";
import { readNotificationsAction } from "../actions";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const notifications = await listNotifications();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo href="/painel" />
          <nav aria-label="Conta" className="flex items-center gap-1 text-sm">
            <Link href="/painel" className="rounded-full px-3 py-2 text-ink-2 hover:bg-ink/5 hover:text-ink">
              {t.dashboard.title}
            </Link>
            <NotificationsMenu items={notifications} onOpen={readNotificationsAction} />
            <Link href="/painel/conta" className="rounded-full px-3 py-2 text-ink-2 hover:bg-ink/5 hover:text-ink">
              {t.dashboard.account}
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="rounded-full px-3 py-2 text-ink-2 hover:bg-ink/5 hover:text-ink">
                {t.auth.signOut}
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
