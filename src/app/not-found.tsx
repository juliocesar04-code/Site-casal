import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="grid justify-items-center gap-5">
        <LogoMark className="h-10 w-10 text-brass" />
        <h1 className="font-display text-5xl">{t.errors.not_found}</h1>
        <Link href="/" className="text-sm underline underline-offset-4">
          {t.experience.notFound.home}
        </Link>
      </div>
    </main>
  );
}
