import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { t } from "@/lib/i18n";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Principal" className="hidden items-center gap-7 text-sm text-ink-2 md:flex">
          <a href="#como-funciona" className="hover:text-ink">{t.site.nav.how}</a>
          <a href="#modelos" className="hover:text-ink">{t.site.nav.templates}</a>
          <a href="#privacidade" className="hover:text-ink">{t.site.nav.privacy}</a>
          <a href="#duvidas" className="hover:text-ink">{t.site.nav.faq}</a>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <LinkButton href="/painel" size="sm">
              {t.site.nav.dashboard}
            </LinkButton>
          ) : (
            <>
              <Link href="/entrar" className="hidden px-3 text-sm text-ink-2 hover:text-ink sm:inline">
                {t.site.nav.signIn}
              </Link>
              <LinkButton href="/criar-conta" size="sm">
                {t.site.nav.start}
              </LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
