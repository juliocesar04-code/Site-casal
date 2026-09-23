import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/dashboard/print-button";
import { LogoMark } from "@/components/ui/logo";
import { uuid } from "@/lib/validation/schemas";
import { fill, t } from "@/lib/i18n";
import { createUserClient } from "@/server/db/clients";
import { env } from "@/server/env";
import { qrSvg } from "@/server/services/qr";

export const metadata: Metadata = { title: t.experience.card.title };

export default async function CardPage({ params }: PageProps<"/painel/memorias/[id]/cartao">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const db = await createUserClient();
  const { data } = await db.from("memories").select("public_slug, status, recipient_name").eq("id", id).maybeSingle();
  const memory = data as { public_slug: string; status: string; recipient_name: string | null } | null;
  if (!memory || (memory.status !== "published" && memory.status !== "scheduled")) notFound();

  const svg = await qrSvg(`${env().APP_URL}/m/${memory.public_slug}`);
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return (
    <main className="grid min-h-dvh place-items-center bg-paper-2 p-6 print:bg-white print:p-0">
      <div className="grid justify-items-center gap-6 print:gap-0">
        <article className="grid w-[105mm] grid-rows-[1fr_auto] border border-dashed border-ink/30 bg-white p-[9mm] text-center text-ink print:border-ink/40">
          <div className="grid justify-items-center gap-[5mm]">
            <LogoMark className="h-[9mm] w-[9mm] text-brass" />
            <p className="font-display text-[8mm] leading-tight">{t.experience.card.title}</p>
            {memory.recipient_name ? (
              <p className="text-[3mm] tracking-[0.3em] text-muted uppercase">
                {fill(t.experience.gate.for, { name: memory.recipient_name })}
              </p>
            ) : null}
            <img src={qrSrc} alt="" className="h-[42mm] w-[42mm]" />
            <p className="text-[2.8mm] text-muted">{t.experience.card.instructions}</p>
          </div>
          <div className="mt-[7mm] grid gap-[2mm] border-t border-ink/15 pt-[5mm] text-left">
            <p className="text-[2.6mm] tracking-[0.2em] text-muted uppercase">{t.experience.card.dedication}</p>
            <div className="h-[5mm] border-b border-ink/15" />
            <div className="h-[5mm] border-b border-ink/15" />
          </div>
        </article>
        <p className="text-xs text-muted print:hidden">{t.experience.card.fold}</p>
        <PrintButton label={t.experience.card.print} />
      </div>
    </main>
  );
}
