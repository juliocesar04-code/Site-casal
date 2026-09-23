import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDialog } from "@/components/dashboard/delete-dialog";
import { FrozenNotice } from "@/components/editor/frozen-notice";
import { Editor } from "@/components/editor/editor";
import { ShareActions } from "@/components/share/share-actions";
import { buttonClass } from "@/components/ui/button";
import { DEFAULT_PRODUCT, formatPrice, PRODUCTS } from "@/domain/catalog";
import { uuid } from "@/lib/validation/schemas";
import { fill, formatDate, formatRelative, t } from "@/lib/i18n";
import { env, paymentsConfigured } from "@/server/env";
import { thumbnailUrls } from "@/server/services/draft-view";
import { getMemoryBundle, markResponsesRead } from "@/server/services/memories";
import { qrPngDataUrl } from "@/server/services/qr";
import { deleteMemoryAction } from "../../../actions";

export default async function MemoryPage({ params, searchParams }: PageProps<"/painel/memorias/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const bundle = await getMemoryBundle(id);
  if (!bundle) notFound();
  const { memory } = bundle;

  if (memory.status === "draft") {
    const thumbs = await thumbnailUrls(bundle.media);
    const query = await searchParams;
    const step = Number(typeof query.etapa === "string" ? query.etapa : "1") - 1;
    return (
      <Editor
        data={{
          memory,
          sections: bundle.sections,
          timeline: bundle.timeline,
          media: bundle.media
            .filter((m) => m.status === "ready")
            .map((m) => ({
              id: m.id,
              kind: m.kind,
              status: m.status,
              section_id: m.section_id,
              contribution_id: m.contribution_id,
              alt: m.alt,
              position: m.position,
              width: m.width,
              height: m.height,
              thumbUrl: thumbs[m.id] ?? null,
            })),
          contributions: bundle.contributions,
          links: bundle.links,
        }}
        initialStep={Number.isFinite(step) ? step : 0}
        price={formatPrice(PRODUCTS[DEFAULT_PRODUCT].amountCents)}
        paymentsAvailable={paymentsConfigured()}
      />
    );
  }

  if (memory.status === "awaiting_payment" || memory.status === "paid") {
    return <FrozenNotice memoryId={memory.id} hasCredit={Boolean(memory.paid_payment_id)} />;
  }

  const url = `${env().APP_URL}/m/${memory.public_slug}`;
  const qr = await qrPngDataUrl(url);
  await markResponsesRead(memory.id);

  return (
    <main className="mx-auto grid max-w-5xl gap-12 px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-3">
        <Link href="/painel" className="text-sm text-muted hover:text-ink">
          ← {t.editor.back}
        </Link>
        <p className="text-xs tracking-[0.2em] text-brass uppercase">{t.dashboard.status[memory.status]}</p>
        <h1 className="font-display text-5xl leading-tight">{memory.title}</h1>
        <p className="text-ink-2">
          {memory.status === "scheduled" && memory.release_at
            ? fill(t.published.scheduledLead, { name: memory.recipient_name ?? "", date: formatDate(memory.release_at, "datetime") })
            : fill(t.published.lead, { name: memory.recipient_name ?? "" })}
        </p>
      </div>

      <section className="grid gap-6 rounded-3xl border border-line bg-card p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="grid min-w-0 gap-4">
          <h2 className="text-sm font-medium text-ink-2">{t.published.link}</h2>
          <code className="block overflow-x-auto rounded-xl bg-paper px-4 py-3 text-sm">{url}</code>
          <ShareActions url={url} />
          <a href={url} target="_blank" rel="noopener" className={buttonClass("primary", "md", "justify-self-start")}>
            {t.published.view}
          </a>
        </div>
        <div id="qr" className="grid scroll-mt-24 justify-items-center gap-3">
          <img src={qr} alt={t.published.qr} width={200} height={200} className="rounded-xl border border-line" />
          <div className="flex gap-3 text-sm">
            <a href={qr} download={`relicario-${memory.public_slug}.png`} className="underline underline-offset-4">
              {t.published.saveQr}
            </a>
            <Link href={`/painel/memorias/${memory.id}/cartao`} className="underline underline-offset-4">
              {t.published.printCard}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-3xl">{t.published.responses}</h2>
        {bundle.responses.length === 0 ? (
          <p className="text-ink-2">{t.published.noResponses}</p>
        ) : (
          <ul className="grid gap-4">
            {bundle.responses.map((response) => (
              <li key={response.id} className="rounded-2xl border border-line bg-card p-6">
                <p className="font-[family-name:var(--font-text)] text-lg leading-relaxed whitespace-pre-line">{response.body}</p>
                <p className="mt-3 text-sm text-muted">
                  {response.author_name ? `${response.author_name} · ` : ""}
                  {formatRelative(response.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2 border-t border-line pt-8 text-sm text-muted">
        {memory.published_at ? <p>{fill(t.published.publishedAt, { date: formatDate(memory.published_at, "datetime") })}</p> : null}
        {memory.content_hash ? (
          <p>
            {t.published.hash}: <code className="break-all">{memory.content_hash}</code>
          </p>
        ) : null}
        <div className="mt-4">
          <DeleteDialog memoryId={memory.id} action={deleteMemoryAction} redirectTo="/painel" />
        </div>
      </section>
    </main>
  );
}
