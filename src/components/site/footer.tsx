import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { t } from "@/lib/i18n";

export function SiteFooter({ contactEmail }: { contactEmail: string | null }) {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-4">
          <Logo />
          <p className="max-w-sm text-sm text-muted">{t.site.tagline}</p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-2">
          <Link href="/privacidade" className="hover:text-ink">{t.site.footer.privacy}</Link>
          <Link href="/termos" className="hover:text-ink">{t.site.footer.terms}</Link>
          <Link href="/seguranca" className="hover:text-ink">{t.site.footer.security}</Link>
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="hover:text-ink">{t.site.footer.contact}</a>
          ) : null}
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted sm:px-6">
        © {new Date().getFullYear()} {t.site.footer.rights}
      </div>
    </footer>
  );
}
