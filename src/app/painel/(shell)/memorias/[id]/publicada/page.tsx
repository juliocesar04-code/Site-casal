import { notFound, redirect } from "next/navigation";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { LinkButton } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { uuid } from "@/lib/validation/schemas";
import { t } from "@/lib/i18n";
import { createUserClient } from "@/server/db/clients";

// Landing page for the provider's return URL. Query parameters from the
// provider are ignored: only the database, updated by the verified webhook,
// decides what happened.
export default async function PaymentReturnPage({ params }: PageProps<"/painel/memorias/[id]/publicada">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const db = await createUserClient();
  const { data: memory } = await db.from("memories").select("id, status").eq("id", id).maybeSingle();
  if (!memory) notFound();

  if (memory.status === "published" || memory.status === "scheduled") redirect(`/painel/memorias/${id}`);
  if (memory.status === "draft") redirect(`/painel/memorias/${id}?etapa=8`);

  const { data: payments } = await db
    .from("payments")
    .select("status")
    .eq("memory_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const latest = (payments?.[0] as { status: string } | undefined)?.status;
  const rejected = latest === "rejected" || latest === "cancelled";

  return (
    <main className="mx-auto grid max-w-lg justify-items-center gap-6 px-4 py-24 text-center">
      {!rejected ? <AutoRefresh seconds={4} /> : null}
      <LogoMark className={`h-12 w-12 text-brass ${rejected ? "" : "animate-pulse"}`} />
      <h1 className="font-display text-5xl leading-tight">{t.published.waiting.title}</h1>
      <p className="leading-relaxed text-ink-2">{rejected ? t.published.waiting.rejected : t.published.waiting.body}</p>
      {rejected ? (
        <LinkButton href={`/painel/memorias/${id}`} size="lg">
          {t.published.waiting.retry}
        </LinkButton>
      ) : null}
    </main>
  );
}
