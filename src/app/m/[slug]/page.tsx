import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/experience/countdown";
import { Experience } from "@/components/experience/experience";
import { ResponseForm } from "@/components/experience/response-form";
import { t } from "@/lib/i18n";
import { hitLimit } from "@/server/security/rate-limit";
import { clientIp, ipHash } from "@/server/security/request";
import { loadPublicMemory } from "@/server/services/public-memory";
import { respondAction } from "./actions";

export const metadata: Metadata = {
  title: t.experience.gate.title,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  // Link previews show only the invitation, never names or photos.
  openGraph: { title: t.experience.gate.title, description: t.site.brand },
};

export default async function MemoryPage({ params }: PageProps<"/m/[slug]">) {
  const { slug } = await params;

  // Slows down anyone sweeping the slug space; results look like a normal 404.
  if (!(await hitLimit("publicMemory", ipHash(await clientIp())))) notFound();

  const result = await loadPublicMemory(slug);
  if (result.state === "not_found") notFound();

  if (result.state === "scheduled") {
    return <Countdown releaseAt={result.releaseAt} serverNow={result.serverNow} recipient={result.recipient} />;
  }

  return (
    <Experience
      mode="public"
      memory={result.memory}
      seal={{ slug, publishedAt: result.publishedAt, hash: result.hash, intact: result.intact }}
      after={
        <div className="grid gap-16">
          <ResponseForm action={respondAction.bind(null, slug)} />
          <p className="text-center text-xs text-[var(--m-muted)]">
            {t.experience.cta.text}{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-[var(--m-ink)]">
              {t.experience.cta.link}
            </Link>
          </p>
        </div>
      }
    />
  );
}
