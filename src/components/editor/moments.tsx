"use client";

import { useRef } from "react";
import {
  addChildAction,
  deleteItemAction,
  reorderAction,
  updateSectionAction,
  updateTimelineAction,
} from "@/app/painel/memorias/[id]/actions";
import { InputField, TextareaField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TRANSITIONS, type Transition } from "@/domain/presets";
import { t } from "@/lib/i18n";
import type { SectionRow, TimelineRow } from "@/server/db/types";
import type { EditorMedia } from "@/components/editor/types";
import { MediaManager } from "@/components/editor/media-manager";

const copy = t.editor.steps.moments;

// Per-row debounced saves, so typing in one chapter never blocks another.
function useRowSaver<P>(save: (id: string, patch: P) => Promise<unknown>) {
  const timers = useRef(new Map<string, number>());
  const patches = useRef(new Map<string, P>());
  return (id: string, patch: P) => {
    patches.current.set(id, { ...(patches.current.get(id) ?? ({} as P)), ...patch });
    const existing = timers.current.get(id);
    if (existing) window.clearTimeout(existing);
    timers.current.set(
      id,
      window.setTimeout(() => {
        const pending = patches.current.get(id);
        patches.current.delete(id);
        if (pending) void save(id, pending);
      }, 700),
    );
  };
}

function Reorder({ onUp, onDown, first, last }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean }) {
  const cls = "grid h-8 w-8 place-items-center rounded-full border border-line text-sm hover:bg-paper disabled:opacity-30";
  return (
    <span className="flex gap-1">
      <button type="button" className={cls} onClick={onUp} disabled={first} aria-label={copy.moveUp} title={copy.moveUp}>
        ↑
      </button>
      <button type="button" className={cls} onClick={onDown} disabled={last} aria-label={copy.moveDown} title={copy.moveDown}>
        ↓
      </button>
    </span>
  );
}

function reorder<T extends { id: string; position: number }>(list: T[], id: string, delta: number): T[] | null {
  const sorted = [...list].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= sorted.length) return null;
  const [moved] = sorted.splice(index, 1);
  sorted.splice(target, 0, moved!);
  return sorted.map((item, position) => ({ ...item, position }));
}

export function ChaptersEditor({
  memoryId,
  sections,
  setSections,
  media,
  setMedia,
}: {
  memoryId: string;
  sections: SectionRow[];
  setSections: (updater: (all: SectionRow[]) => SectionRow[]) => void;
  media: EditorMedia[];
  setMedia: (updater: (all: EditorMedia[]) => EditorMedia[]) => void;
}) {
  const save = useRowSaver((id: string, patch: Partial<SectionRow>) => updateSectionAction(id, patch));
  const sorted = [...sections].sort((a, b) => a.position - b.position);

  const update = (id: string, patch: Partial<SectionRow>) => {
    setSections((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    save(id, patch);
  };

  const add = async () => {
    const result = await addChildAction("memory_sections", memoryId);
    if (result.ok) {
      setSections((all) => [
        ...all,
        { id: result.data, memory_id: memoryId, title: "", body: "", event_date: null, transition: "fade", position: all.length },
      ]);
    }
  };

  const move = async (id: string, delta: number) => {
    const next = reorder(sections, id, delta);
    if (!next) return;
    setSections(() => next);
    await reorderAction("memory_sections", memoryId, next.map((s) => s.id));
  };

  return (
    <div className="grid gap-6">
      {sorted.map((section, index) => (
        <fieldset key={section.id} className="grid gap-5 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <legend className="sr-only">{section.title || `${copy.chapterTitle} ${index + 1}`}</legend>
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-2xl text-brass">{String(index + 1).padStart(2, "0")}</span>
            <Reorder
              first={index === 0}
              last={index === sorted.length - 1}
              onUp={() => move(section.id, -1)}
              onDown={() => move(section.id, 1)}
            />
          </div>
          <InputField
            label={copy.chapterTitle}
            value={section.title}
            maxLength={120}
            onChange={(e) => update(section.id, { title: e.target.value })}
          />
          <TextareaField
            label={copy.chapterBody}
            value={section.body}
            maxLength={6000}
            showCounter
            onChange={(e) => update(section.id, { body: e.target.value })}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <InputField
              label={copy.chapterDate}
              type="date"
              value={section.event_date ?? ""}
              onChange={(e) => update(section.id, { event_date: e.target.value || null })}
            />
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-ink-2">{copy.chapterTransition}</span>
              <select
                value={section.transition}
                onChange={(e) => update(section.id, { transition: e.target.value as Transition })}
                className="rounded-xl border border-line bg-card px-4 py-3"
              >
                {TRANSITIONS.map((value) => (
                  <option key={value} value={value}>
                    {copy.transitions[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <MediaManager
            memoryId={memoryId}
            sectionId={section.id}
            items={media.filter((m) => m.section_id === section.id && !m.contribution_id)}
            onChange={setMedia}
            compact
          />
          <div className="text-right">
            <button
              type="button"
              className="text-sm text-danger underline-offset-4 hover:underline"
              onClick={async () => {
                setSections((all) => all.filter((s) => s.id !== section.id));
                setMedia((all) => all.map((m) => (m.section_id === section.id ? { ...m, section_id: null } : m)));
                await deleteItemAction("memory_sections", section.id);
              }}
            >
              {copy.removeChapter}
            </button>
          </div>
        </fieldset>
      ))}
      <Button variant="secondary" onClick={add} disabled={sections.length >= 12}>
        {copy.addChapter}
      </Button>
    </div>
  );
}

export function TimelineEditor({
  memoryId,
  events,
  setEvents,
  media,
}: {
  memoryId: string;
  events: TimelineRow[];
  setEvents: (updater: (all: TimelineRow[]) => TimelineRow[]) => void;
  media: EditorMedia[];
}) {
  const save = useRowSaver((id: string, patch: Partial<TimelineRow>) => updateTimelineAction(id, patch));
  const sorted = [...events].sort((a, b) => a.position - b.position);
  const images = media.filter((m) => m.kind === "image" && !m.contribution_id && m.status === "ready");

  const update = (id: string, patch: Partial<TimelineRow>) => {
    setEvents((all) => all.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    save(id, patch);
  };

  const add = async () => {
    const result = await addChildAction("memory_timeline", memoryId);
    if (result.ok) {
      setEvents((all) => [
        ...all,
        { id: result.data, memory_id: memoryId, title: "", body: "", event_date: null, media_id: null, position: all.length },
      ]);
    }
  };

  const move = async (id: string, delta: number) => {
    const next = reorder(events, id, delta);
    if (!next) return;
    setEvents(() => next);
    await reorderAction("memory_timeline", memoryId, next.map((e) => e.id));
  };

  return (
    <div className="grid gap-5">
      <ol className="grid gap-5">
        {sorted.map((event, index) => (
          <li key={event.id} className="grid gap-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-brass" />
              <Reorder
                first={index === 0}
                last={index === sorted.length - 1}
                onUp={() => move(event.id, -1)}
                onDown={() => move(event.id, 1)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <InputField
                label={copy.eventDate}
                type="date"
                value={event.event_date ?? ""}
                onChange={(e) => update(event.id, { event_date: e.target.value || null })}
              />
              <InputField
                label={copy.eventTitle}
                value={event.title}
                maxLength={120}
                onChange={(e) => update(event.id, { title: e.target.value })}
              />
            </div>
            <TextareaField
              label={copy.eventBody}
              value={event.body}
              maxLength={1200}
              rows={3}
              className="min-h-24"
              onChange={(e) => update(event.id, { body: e.target.value })}
            />
            {images.length > 0 ? (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium text-ink-2">{copy.eventMedia}</legend>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    aria-pressed={event.media_id === null}
                    onClick={() => update(event.id, { media_id: null })}
                    className={`grid h-16 w-16 shrink-0 place-items-center rounded-lg border text-[0.65rem] text-muted ${
                      event.media_id === null ? "border-ink" : "border-line"
                    }`}
                  >
                    {copy.eventNoMedia}
                  </button>
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      aria-pressed={event.media_id === image.id}
                      aria-label={image.alt || copy.eventMedia}
                      onClick={() => update(event.id, { media_id: image.id })}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                        event.media_id === image.id ? "border-ink" : "border-transparent"
                      }`}
                    >
                      {image.thumbUrl ? <img src={image.thumbUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <div className="text-right">
              <button
                type="button"
                className="text-sm text-danger underline-offset-4 hover:underline"
                onClick={async () => {
                  setEvents((all) => all.filter((e) => e.id !== event.id));
                  await deleteItemAction("memory_timeline", event.id);
                }}
              >
                {copy.removeEvent}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <Button variant="secondary" onClick={add} disabled={events.length >= 40}>
        {copy.addEvent}
      </Button>
    </div>
  );
}
