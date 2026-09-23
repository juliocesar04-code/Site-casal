import Link from "next/link";
import { t } from "@/lib/i18n";

export default function MemoryNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-night px-6 text-center text-paper">
      <div className="grid max-w-md gap-5">
        <h1 className="font-display text-4xl">{t.experience.notFound.title}</h1>
        <p className="text-paper/70">{t.experience.notFound.body}</p>
        <Link href="/" className="text-sm underline underline-offset-4">
          {t.experience.notFound.home}
        </Link>
      </div>
    </main>
  );
}
