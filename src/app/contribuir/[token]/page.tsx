import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContributionForm } from "@/components/contribute/contribution-form";
import { LogoMark } from "@/components/ui/logo";
import { fill, t } from "@/lib/i18n";
import { hitLimit } from "@/server/security/rate-limit";
import { clientIp, ipHash } from "@/server/security/request";
import { contributionContext } from "@/server/services/collaboration";

export const metadata: Metadata = {
  title: t.contribute.title,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ContributePage({ params }: PageProps<"/contribuir/[token]">) {
  const { token } = await params;
  if (!(await hitLimit("contributionView", ipHash(await clientIp())))) notFound();

  const context = await contributionContext(token);

  return (
    <main className="grain grid min-h-dvh place-items-center px-4 py-12">
      <div className="grid w-full max-w-lg gap-8">
        <LogoMark className="h-9 w-9 text-brass" />
        {context.state === "open" ? (
          <>
            <div className="grid gap-3">
              <h1 className="font-display text-5xl leading-tight">{t.contribute.title}</h1>
              <p className="leading-relaxed text-ink-2">
                {context.sender
                  ? fill(t.contribute.lead, { sender: context.sender, recipient: context.recipient ?? "" })
                  : fill(t.contribute.leadNoSender, { recipient: context.recipient ?? "" })}
              </p>
              <p className="text-sm text-muted">{t.contribute.privacy}</p>
            </div>
            <ContributionForm token={token} />
          </>
        ) : (
          <div className="grid gap-3">
            <h1 className="font-display text-4xl leading-tight">
              {context.state === "closed" ? t.contribute.closed.title : t.contribute.invalid.title}
            </h1>
            <p className="text-ink-2">{context.state === "closed" ? t.contribute.closed.body : t.contribute.invalid.body}</p>
          </div>
        )}
      </div>
    </main>
  );
}
