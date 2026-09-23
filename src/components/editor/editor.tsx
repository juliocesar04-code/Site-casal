"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { checkoutAction, saveFieldsAction } from "@/app/painel/memorias/[id]/actions";
import { CollaborationPanel } from "@/components/editor/collaboration";
import { MediaManager } from "@/components/editor/media-manager";
import { ChaptersEditor, TimelineEditor } from "@/components/editor/moments";
import type { EditableFields, EditorData, EditorMedia } from "@/components/editor/types";
import { useAutosave } from "@/components/editor/use-autosave";
import { TemplateMiniature } from "@/components/site/template-miniature";
import { Button } from "@/components/ui/button";
import { InputField, TextareaField } from "@/components/ui/field";
import { OCCASIONS, TEMPLATE_IDS, THEME_IDS, THEMES, type TemplateId } from "@/domain/presets";
import { track } from "@/lib/analytics-client";
import { fill, formatDate, t } from "@/lib/i18n";

const STEPS = ["recipient", "template", "story", "moments", "personalize", "preview", "review", "publish"] as const;
type Step = (typeof STEPS)[number];

const occasionLabels: Record<(typeof OCCASIONS)[number], string> = {
  namoro: "Namoro",
  casamento: "Casamento",
  amizade: "Amizade",
  familia: "Família",
  aniversario: "Aniversário",
  pedido: "Pedido de casamento",
  formatura: "Formatura",
  nascimento: "Nascimento",
  homenagem: "Homenagem",
  agradecimento: "Agradecimento",
  despedida: "Despedida",
  dia_das_maes: "Dia das Mães",
  dia_dos_pais: "Dia dos Pais",
  viagem: "Viagem",
  grupo: "Grupo",
  professor: "Professores",
  outro: "Outra",
};

// Brazil has had no daylight saving time since 2019, so Brasília is UTC-3.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(new Date(iso).getTime() - 3 * 3_600_000);
  return date.toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? `${value}:00-03:00` : null;
}

export function Editor({
  data,
  initialStep,
  price,
  paymentsAvailable,
}: {
  data: EditorData;
  initialStep: number;
  price: string;
  paymentsAvailable: boolean;
}) {
  const router = useRouter();
  const memoryId = data.memory.id;
  const [step, setStep] = useState<Step>(STEPS[Math.min(Math.max(initialStep, 0), STEPS.length - 1)]!);
  const [fields, setFields] = useState<EditableFields>({
    template_id: data.memory.template_id,
    theme: data.memory.theme,
    occasion: data.memory.occasion,
    title: data.memory.title,
    recipient_name: data.memory.recipient_name,
    sender_name: data.memory.sender_name,
    opening_line: data.memory.opening_line,
    message: data.memory.message,
    closing_line: data.memory.closing_line,
    release_at: data.memory.release_at,
  });
  const [sections, setSections] = useState(data.sections);
  const [timeline, setTimeline] = useState(data.timeline);
  const [media, setMediaState] = useState<EditorMedia[]>(data.media);
  const [contributions, setContributions] = useState(data.contributions);
  const [links, setLinks] = useState(data.links);
  const [scheduleMode, setScheduleMode] = useState(data.memory.release_at ? "later" : "now");
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [previewKey, setPreviewKey] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, startPublish] = useTransition();

  const saver = useCallback((patch: Partial<EditableFields>) => saveFieldsAction(memoryId, patch), [memoryId]);
  const autosave = useAutosave<EditableFields>(saver);
  const setMedia = useCallback((updater: (all: EditorMedia[]) => EditorMedia[]) => setMediaState(updater), []);

  const set = <K extends keyof EditableFields>(key: K, value: EditableFields[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
    autosave.queue({ [key]: value } as Partial<EditableFields>);
  };

  const index = STEPS.indexOf(step);
  const go = async (target: Step) => {
    await autosave.flush();
    setStep(target);
    if (target === "preview") {
      setPreviewKey((key) => key + 1);
      track("preview_opened", { template: fields.template_id });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("etapa", String(index + 1));
    window.history.replaceState(null, "", url);
  }, [index]);

  const galleryMedia = media.filter((m) => !m.section_id && !m.contribution_id);
  const approved = contributions.filter((c) => c.status === "approved").length;
  const pendingReview = contributions.filter((c) => c.status === "pending").length;
  const ready = Boolean(fields.title?.trim() && fields.recipient_name?.trim());

  const saveLabel = useMemo(() => {
    if (autosave.status === "saving") return t.editor.saving;
    if (autosave.status === "error") return t.editor.saveFailed;
    if (autosave.status === "saved") return t.editor.saved;
    return "";
  }, [autosave.status]);

  const publish = () =>
    startPublish(async () => {
      await autosave.flush();
      const result = await checkoutAction(memoryId, confirmed);
      if (!result.ok) {
        setPublishError(t.errors[result.error as keyof typeof t.errors] ?? t.errors.generic);
        return;
      }
      track("checkout_started", { template: fields.template_id });
      if (result.data.kind === "redirect") window.location.assign(result.data.url);
      else router.push(`/painel/memorias/${memoryId}/publicada`);
    });

  const steps = t.editor.steps;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[14rem_1fr] lg:py-12">
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <Link href="/painel" className="text-sm text-muted hover:text-ink">
          ← {t.editor.back}
        </Link>
        <p className="mt-6 text-xs tracking-[0.2em] text-muted uppercase">
          {fill(t.editor.step, { current: index + 1, total: STEPS.length })}
        </p>
        <nav aria-label="Etapas" className="mt-3">
          <ol className="flex gap-1 overflow-x-auto pb-2 lg:grid lg:gap-0.5 lg:overflow-visible">
            {STEPS.map((key, i) => (
              <li key={key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(key)}
                  aria-current={key === step ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm transition-colors lg:rounded-lg ${
                    key === step ? "bg-ink text-paper" : "text-ink-2 hover:bg-ink/5"
                  }`}
                >
                  <span className="font-display text-base tabular-nums opacity-70">{i + 1}</span>
                  {steps[key].nav}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <p className="mt-4 h-5 text-xs text-muted" role="status" aria-live="polite">
          {saveLabel}
        </p>
      </aside>

      <section className="min-w-0">
        <header className="mb-10 grid gap-3">
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">{steps[step].title}</h1>
          {"lead" in steps[step] ? (
            <p className="max-w-2xl text-ink-2">{fill((steps[step] as { lead: string }).lead, { price })}</p>
          ) : null}
        </header>

        {step === "recipient" ? (
          <div className="grid max-w-xl gap-6">
            <InputField
              label={steps.recipient.recipient}
              hint={steps.recipient.recipientHint}
              value={fields.recipient_name ?? ""}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => set("recipient_name", e.target.value)}
            />
            <InputField
              label={steps.recipient.sender}
              hint={steps.recipient.senderHint}
              value={fields.sender_name ?? ""}
              maxLength={80}
              onChange={(e) => set("sender_name", e.target.value)}
            />
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-ink-2">{steps.recipient.occasion}</span>
              <select
                value={fields.occasion ?? ""}
                onChange={(e) => set("occasion", (e.target.value || null) as EditableFields["occasion"])}
                className="rounded-xl border border-line bg-card px-4 py-3"
              >
                <option value="">{steps.recipient.occasionNone}</option>
                {OCCASIONS.map((occasion) => (
                  <option key={occasion} value={occasion}>
                    {occasionLabels[occasion]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === "template" ? (
          <div role="radiogroup" aria-label={steps.template.title} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {TEMPLATE_IDS.map((id) => {
              const selected = fields.template_id === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    set("template_id", id as TemplateId);
                    track("template_selected", { template: id });
                  }}
                  className={`grid gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${
                    selected ? "border-ink bg-card" : "border-transparent hover:border-line"
                  }`}
                >
                  <TemplateMiniature id={id} />
                  <span className="px-1">
                    <span className="block font-display text-2xl">{t.site.templates.items[id].name}</span>
                    <span className="block text-sm leading-relaxed text-ink-2">{t.site.templates.items[id].body}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {step === "story" ? (
          <div className="grid max-w-2xl gap-6">
            <InputField
              label={steps.story.title_}
              hint={steps.story.titleHint}
              value={fields.title ?? ""}
              maxLength={120}
              onChange={(e) => set("title", e.target.value)}
            />
            <InputField
              label={steps.story.opening}
              hint={steps.story.openingHint}
              value={fields.opening_line ?? ""}
              maxLength={140}
              showCounter
              onChange={(e) => set("opening_line", e.target.value)}
            />
            <TextareaField
              label={steps.story.message}
              hint={steps.story.messageHint}
              value={fields.message ?? ""}
              maxLength={6000}
              showCounter
              rows={12}
              className="font-[family-name:var(--font-text)] text-[1.05rem]"
              onChange={(e) => set("message", e.target.value)}
            />
            <TextareaField
              label={steps.story.closing}
              hint={steps.story.closingHint}
              value={fields.closing_line ?? ""}
              maxLength={280}
              showCounter
              rows={3}
              className="min-h-20"
              onChange={(e) => set("closing_line", e.target.value)}
            />
          </div>
        ) : null}

        {step === "moments" ? (
          <div className="grid gap-14">
            <section className="grid gap-4">
              <div>
                <h2 className="font-display text-3xl">{steps.moments.gallery}</h2>
                <p className="text-sm text-muted">{steps.moments.galleryHint}</p>
              </div>
              <MediaManager memoryId={memoryId} sectionId={null} items={galleryMedia} onChange={setMedia} />
            </section>
            <section className="grid gap-4">
              <div>
                <h2 className="font-display text-3xl">{steps.moments.chapters}</h2>
                <p className="text-sm text-muted">{steps.moments.chaptersHint}</p>
              </div>
              <ChaptersEditor
                memoryId={memoryId}
                sections={sections}
                setSections={setSections}
                media={media}
                setMedia={setMedia}
              />
            </section>
            <section className="grid gap-4">
              <div>
                <h2 className="font-display text-3xl">{steps.moments.timeline}</h2>
                <p className="text-sm text-muted">{steps.moments.timelineHint}</p>
              </div>
              <TimelineEditor memoryId={memoryId} events={timeline} setEvents={setTimeline} media={media} />
            </section>
            <section className="grid gap-4">
              <h2 className="font-display text-3xl">{t.editor.collaboration.title}</h2>
              <CollaborationPanel
                memoryId={memoryId}
                links={links}
                setLinks={setLinks}
                contributions={contributions}
                setContributions={setContributions}
                media={media}
              />
            </section>
          </div>
        ) : null}

        {step === "personalize" ? (
          <div className="grid gap-12">
            <fieldset className="grid gap-4">
              <legend className="mb-4 font-display text-3xl">{steps.personalize.theme}</legend>
              <div role="radiogroup" className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {THEME_IDS.map((id) => {
                  const theme = THEMES[id];
                  const selected = fields.theme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => set("theme", id)}
                      className={`grid gap-3 rounded-2xl border-2 p-2 text-left ${selected ? "border-ink" : "border-transparent hover:border-line"}`}
                    >
                      <span
                        className="grid aspect-[3/4] content-end gap-1.5 rounded-xl p-3"
                        style={{ background: theme.vars["--m-bg"] }}
                      >
                        <span className="block h-2 w-3/4 rounded-full" style={{ background: theme.vars["--m-ink"] }} />
                        <span className="block h-1.5 w-1/2 rounded-full" style={{ background: theme.vars["--m-muted"] }} />
                        <span className="mt-1 block h-1.5 w-1/4 rounded-full" style={{ background: theme.vars["--m-accent"] }} />
                      </span>
                      <span className="px-1 text-sm font-medium">{steps.personalize.themes[id]}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="grid max-w-xl gap-4">
              <legend className="mb-4 font-display text-3xl">{steps.personalize.release}</legend>
              {(["now", "later"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
                  <input
                    type="radio"
                    name="release"
                    checked={scheduleMode === mode}
                    onChange={() => {
                      setScheduleMode(mode);
                      if (mode === "now") {
                        setReleaseError(null);
                        set("release_at", null);
                      }
                    }}
                    className="accent-ink"
                  />
                  {mode === "now" ? steps.personalize.releaseNow : steps.personalize.releaseLater}
                </label>
              ))}
              {scheduleMode === "later" ? (
                <InputField
                  label={steps.personalize.releaseLater}
                  hint={steps.personalize.releaseHint}
                  error={releaseError}
                  type="datetime-local"
                  defaultValue={toLocalInput(fields.release_at)}
                  onChange={(e) => {
                    const iso = fromLocalInput(e.target.value);
                    const time = iso ? Date.parse(iso) : NaN;
                    if (!iso || !(time > Date.now() + 60_000) || time > Date.now() + 5 * 365 * 86_400_000) {
                      setReleaseError(steps.personalize.releaseInvalid);
                      return;
                    }
                    setReleaseError(null);
                    set("release_at", iso);
                  }}
                />
              ) : null}
            </fieldset>
          </div>
        ) : null}

        {step === "preview" ? (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2">
              {(["mobile", "desktop"] as const).map((device) => (
                <button
                  key={device}
                  type="button"
                  aria-pressed={previewDevice === device}
                  onClick={() => setPreviewDevice(device)}
                  className={`rounded-full px-4 py-2 text-sm ${previewDevice === device ? "bg-ink text-paper" : "border border-line text-ink-2"}`}
                >
                  {steps.preview[device]}
                </button>
              ))}
              <a
                href={`/painel/memorias/${memoryId}/visualizar/quadro`}
                target="_blank"
                rel="noopener"
                className="ml-auto text-sm text-ink-2 underline underline-offset-4"
              >
                {steps.preview.open}
              </a>
            </div>
            <div className="grid place-items-center overflow-hidden rounded-3xl border border-line bg-paper-2 p-4 sm:p-8">
              <iframe
                key={previewKey}
                title={steps.preview.title}
                src={`/painel/memorias/${memoryId}/visualizar/quadro`}
                className={`rounded-[1.6rem] border-8 border-night bg-night transition-[width] duration-500 ${
                  previewDevice === "mobile" ? "h-[720px] w-[390px] max-w-full" : "h-[680px] w-full"
                }`}
              />
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="grid max-w-2xl gap-8">
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              <ReviewRow label={steps.review.checklist.recipient} value={fields.recipient_name} />
              <ReviewRow label={steps.review.checklist.sender} value={fields.sender_name} />
              <ReviewRow label={steps.review.checklist.title} value={fields.title} />
              <ReviewRow
                label={fill(steps.review.checklist.template, { name: t.site.templates.items[fields.template_id].name })}
                value={steps.personalize.themes[fields.theme]}
              />
              <ReviewRow
                label={steps.review.checklist.message}
                value={fields.message ? `${fields.message.slice(0, 90)}${fields.message.length > 90 ? "…" : ""}` : null}
              />
              <ReviewRow label={fill(steps.review.checklist.media, { count: media.filter((m) => !m.contribution_id).length })} value="" />
              <ReviewRow label={fill(steps.review.checklist.chapters, { count: sections.length })} value="" />
              <ReviewRow label={fill(steps.review.checklist.timeline, { count: timeline.length })} value="" />
              {contributions.length > 0 ? (
                <ReviewRow label={fill(steps.review.checklist.contributions, { count: approved })} value="" />
              ) : null}
              <ReviewRow
                label={fill(steps.review.checklist.release, {
                  when: fields.release_at ? formatDate(fields.release_at, "datetime") : steps.review.checklist.releaseNow,
                })}
                value=""
              />
            </ul>
            {pendingReview > 0 ? (
              <p className="rounded-lg bg-brass/10 px-4 py-3 text-sm text-brass">
                {fill(steps.review.checklist.pendingContributions, { count: pendingReview })}
              </p>
            ) : null}
            {!ready ? <p className="text-sm text-danger">{steps.review.missing}</p> : null}
            <label className="flex items-start gap-3 rounded-2xl border border-ink/20 bg-card p-5">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-ink"
              />
              <span className="leading-relaxed">{steps.review.confirm}</span>
            </label>
          </div>
        ) : null}

        {step === "publish" ? (
          <div className="grid max-w-xl gap-6">
            {data.memory.paid_payment_id ? (
              <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">{steps.publish.credit}</p>
            ) : null}
            {!paymentsAvailable && !data.memory.paid_payment_id ? (
              <p className="rounded-xl bg-danger/8 px-4 py-3 text-sm text-danger">{steps.publish.unavailable}</p>
            ) : null}
            {!confirmed ? (
              <p className="text-sm text-ink-2">
                {steps.review.confirm}{" "}
                <button type="button" className="underline underline-offset-4" onClick={() => go("review")}>
                  {steps.review.nav}
                </button>
              </p>
            ) : null}
            {publishError ? (
              <p role="alert" className="text-sm text-danger">
                {publishError}
              </p>
            ) : null}
            <Button
              size="lg"
              onClick={publish}
              disabled={!confirmed || !ready || publishing || (!paymentsAvailable && !data.memory.paid_payment_id)}
            >
              {publishing ? steps.publish.redirecting : data.memory.paid_payment_id ? steps.publish.publishCredit : steps.publish.pay}
            </Button>
          </div>
        ) : null}

        <footer className="mt-14 flex items-center justify-between border-t border-line pt-6">
          <Button variant="ghost" onClick={() => go(STEPS[index - 1]!)} disabled={index === 0}>
            {t.editor.previous}
          </Button>
          {index < STEPS.length - 1 ? (
            <Button onClick={() => go(STEPS[index + 1]!)} disabled={step === "review" && (!confirmed || !ready)}>
              {t.editor.next}
            </Button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | null }) {
  const missing = value === null || value === undefined || value.trim() === "";
  return (
    <li className="flex items-start justify-between gap-6 px-5 py-4 text-sm">
      <span className="text-ink-2">{label}</span>
      {value !== "" ? (
        <span className={`text-right ${missing ? "text-danger" : "text-ink"}`}>{missing ? "—" : value}</span>
      ) : null}
    </li>
  );
}
