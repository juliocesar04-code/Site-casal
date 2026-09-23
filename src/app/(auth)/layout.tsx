import { Logo } from "@/components/ui/logo";
import { t } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <aside className="grain relative hidden flex-col justify-between overflow-hidden bg-night p-12 text-paper lg:flex">
        <Logo light />
        <div className="grid max-w-md gap-6">
          <p className="font-display text-5xl leading-[1.05]">{t.site.hero.title}</p>
          <p className="text-paper/60">{t.site.tagline}</p>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -bottom-40 h-[32rem] w-[32rem] rounded-full border border-white/10"
        />
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto grid w-full max-w-sm flex-1 content-center py-12">{children}</div>
      </main>
    </div>
  );
}
