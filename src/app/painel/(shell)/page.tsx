import Link from "next/link";
import { DeleteDialog } from "@/components/dashboard/delete-dialog";
import { ShareActions } from "@/components/share/share-actions";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { fill, formatDate, formatRelative, t } from "@/lib/i18n";
import { env } from "@/server/env";
import { listDashboard, type DashboardItem } from "@/server/services/memories";
import { signReadUrls } from "@/server/storage/media-storage";
import { createMemoryAction, deleteMemoryAction } from "../actions";

const TABS = {
  rascunhos: { label: t.dashboard.tabs.drafts, match: (m: DashboardItem) => m.status === "draft" || m.status === "awaiting_payment" || m.status === "paid" },
  publicadas: { label: t.dashboard.tabs.published, match: (m: DashboardItem) => m.status === "published" },
  agendadas: { label: t.dashboard.tabs.scheduled, match: (m: DashboardItem) => m.status === "scheduled" },
  colaborativas: { label: t.dashboard.tabs.collaborative, match: (m: DashboardItem) => m.is_collaborative },
} as const;

type TabKey = keyof typeof TABS;

const statusTone: Record<string, string> = {
  draft: "bg-paper-2 text-ink-2",
  awaiting_payment: "bg-brass/15 text-brass",
  paid: "bg-brass/15 text-brass",
  scheduled: "bg-night text-paper",
  published: "bg-ok/12 text-ok",
};

export default async function DashboardPage({ searchParams }: PageProps<"/painel">) {
  const params = await searchParams;
  const items = await listDashboard();
  const tab: TabKey = typeof params.aba === "string" && params.aba in TABS ? (params.aba as TabKey) : "rascunhos";
  const visible = items.filter(TABS[tab].match);
  const thumbs = await signReadUrls(visible.flatMap((item) => (item.thumb_path ? [item.thumb_path] : [])));
  const appUrl = env().APP_URL;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="font-display text-5xl">{t.dashboard.title}</h1>
        <form action={createMemoryAction}>
          <Button type="submit" size="lg">
            {t.dashboard.new}
          </Button>
        </form>
      </div>

      {params.erro ? (
        <p role="alert" className="mt-6 rounded-lg bg-danger/8 px-4 py-3 text-sm text-danger">
          {t.errors.limit_reached}
        </p>
      ) : null}

      <nav aria-label="Filtros" className="mt-10 flex gap-1 overflow-x-auto border-b border-line">
        {(Object.keys(TABS) as TabKey[]).map((key) => {
          const count = items.filter(TABS[key].match).length;
          const active = key === tab;
          return (
            <Link
              key={key}
              href={`/painel?aba=${key}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition-colors ${
                active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {TABS[key].label}
              <span className="ml-2 text-xs tabular-nums opacity-60">{count}</span>
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <div className="mt-16 grid justify-items-center gap-5 rounded-3xl border border-dashed border-line px-6 py-20 text-center">
          <LogoMark className="h-10 w-10 text-brass" />
          <h2 className="font-display text-4xl">{t.dashboard.empty.title}</h2>
          <p className="max-w-sm text-ink-2">{t.dashboard.empty.body}</p>
          <form action={createMemoryAction}>
            <Button type="submit" size="lg">
              {t.dashboard.empty.cta}
            </Button>
          </form>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const thumb = item.thumb_path ? thumbs.get(item.thumb_path) : undefined;
            const live = item.status === "published" || item.status === "scheduled";
            const url = `${appUrl}/m/${item.public_slug}`;
            return (
              <li key={item.id} className="grid overflow-hidden rounded-2xl border border-line bg-card">
                <Link href={`/painel/memorias/${item.id}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <LogoMark className="h-10 w-10 text-line" />
                      </div>
                    )}
                    <span className={`absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-medium ${statusTone[item.status] ?? ""}`}>
                      {t.dashboard.status[item.status]}
                    </span>
                  </div>
                  <div className="grid gap-1 p-5 pb-3">
                    <h2 className="truncate font-display text-2xl">{item.title || t.dashboard.untitled}</h2>
                    <p className="truncate text-sm text-ink-2">
                      {item.recipient_name ? fill(t.dashboard.for, { name: item.recipient_name }) : t.dashboard.noRecipient}
                    </p>
                    <p className="text-xs text-muted">
                      {item.status === "scheduled" && item.release_at
                        ? fill(t.dashboard.opensOn, { date: formatDate(item.release_at, "datetime") })
                        : item.published_at
                          ? fill(t.dashboard.publishedOn, { date: formatDate(item.published_at) })
                          : fill(t.dashboard.updated, { date: formatRelative(item.updated_at) })}
                    </p>
                    {item.pending_contributions > 0 ? (
                      <p className="text-xs font-medium text-brass">
                        {fill(t.dashboard.pendingContributions, { count: item.pending_contributions })}
                      </p>
                    ) : null}
                    {item.unread_responses > 0 ? (
                      <p className="text-xs font-medium text-brass">
                        {fill(t.dashboard.unreadResponses, { count: item.unread_responses })}
                      </p>
                    ) : null}
                  </div>
                </Link>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-5 py-4">
                  {live ? (
                    <>
                      <ShareActions url={url} compact />
                      <Link href={`/painel/memorias/${item.id}#qr`} className="text-sm text-ink-2 hover:text-ink">
                        {t.dashboard.actions.qr}
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href={`/painel/memorias/${item.id}`} className="text-sm font-medium text-ink hover:underline">
                        {item.status === "draft" ? t.dashboard.actions.continue : t.dashboard.actions.checkout}
                      </Link>
                      <Link href={`/painel/memorias/${item.id}/visualizar`} className="text-sm text-ink-2 hover:text-ink">
                        {t.dashboard.actions.preview}
                      </Link>
                    </>
                  )}
                  <span className="ml-auto">
                    <DeleteDialog memoryId={item.id} action={deleteMemoryAction} />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
