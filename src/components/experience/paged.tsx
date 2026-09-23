"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TEMPLATES, type Transition } from "@/domain/presets";
import type { ViewMedia, ViewMemory } from "@/domain/snapshot";
import { fill, formatDate, t } from "@/lib/i18n";
import { track } from "@/lib/analytics-client";
import { Kicker, MediaView, Paragraphs, Seal, type SealInfo } from "@/components/experience/blocks";

type Slide = { key: string; transition: Transition; kenBurns?: boolean; content: ReactNode; backdrop?: ViewMedia };

const variants: Record<Transition, Variants> = {
  fade: { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { enter: { opacity: 0, x: 60 }, center: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -60 } },
  zoom: { enter: { opacity: 0, scale: 0.94 }, center: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.04 } },
  none: { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 1 } },
};

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-2xl gap-6 px-6 text-center">{children}</div>;
}

function buildSlides(memory: ViewMemory, seal: SealInfo, after: ReactNode): Slide[] {
  const slides: Slide[] = [];
  const template = TEMPLATES[memory.template];

  slides.push({
    key: "cover",
    transition: "fade",
    backdrop: memory.gallery[0],
    kenBurns: true,
    content: (
      <Centered>
        {memory.title ? <h1 className="font-display text-5xl leading-[1.02] sm:text-7xl">{memory.title}</h1> : null}
        {memory.sender ? (
          <p className="text-[0.72rem] tracking-[0.3em] uppercase opacity-80">{fill(t.experience.from, { name: memory.sender })}</p>
        ) : null}
      </Centered>
    ),
  });

  for (const block of template.blocks) {
    if (block === "gallery") {
      memory.gallery.slice(memory.gallery[0] ? 1 : 0).forEach((media) => {
        slides.push(
          media.kind === "image"
            ? { key: `g-${media.id}`, transition: "fade", backdrop: media, kenBurns: true, content: null }
            : {
                key: `g-${media.id}`,
                transition: "fade",
                content: (
                  <div className="mx-auto w-full max-w-4xl px-4">
                    <MediaView media={media} className="max-h-[78dvh] rounded-sm" />
                  </div>
                ),
              },
        );
      });
    }

    if (block === "message" && memory.message) {
      memory.message
        .split(/\n{2,}/)
        .filter((part) => part.trim())
        .forEach((part, index) => {
          slides.push({
            key: `msg-${index}`,
            transition: "fade",
            content: (
              <Centered>
                <p className="font-[family-name:var(--font-text)] text-2xl leading-[1.6] whitespace-pre-line sm:text-[1.9rem]">
                  {part}
                </p>
              </Centered>
            ),
          });
        });
    }

    if (block === "chapters") {
      memory.sections.forEach((chapter, index) => {
        slides.push({
          key: `ch-${chapter.id}`,
          transition: chapter.transition,
          backdrop: chapter.media[0]?.kind === "image" ? chapter.media[0] : undefined,
          kenBurns: true,
          content: (
            <Centered>
              <Kicker>{fill(t.experience.chapter, { n: index + 1 })}</Kicker>
              {chapter.title ? <h2 className="font-display text-5xl leading-tight sm:text-6xl">{chapter.title}</h2> : null}
              {chapter.date ? <p className="text-sm opacity-75">{formatDate(chapter.date)}</p> : null}
            </Centered>
          ),
        });
        if (chapter.body || chapter.media.length > 1 || chapter.media[0]?.kind === "video") {
          slides.push({
            key: `chb-${chapter.id}`,
            transition: chapter.transition,
            content: (
              <div className="mx-auto grid w-full max-w-3xl gap-8 px-6">
                {chapter.media
                  .filter((media, i) => i > 0 || media.kind === "video")
                  .map((media) => (
                    <MediaView key={media.id} media={media} className="max-h-[50dvh] rounded-sm object-contain" />
                  ))}
                {chapter.body ? (
                  <Paragraphs
                    text={chapter.body}
                    className="text-center font-[family-name:var(--font-text)] text-xl leading-[1.7] sm:text-2xl"
                  />
                ) : null}
              </div>
            ),
          });
        }
      });
    }

    if (block === "timeline") {
      memory.timeline.forEach((event) => {
        slides.push({
          key: `tl-${event.id}`,
          transition: "slide",
          backdrop: event.media?.kind === "image" ? event.media : undefined,
          content: (
            <Centered>
              {event.date ? <Kicker>{formatDate(event.date)}</Kicker> : null}
              {event.title ? <h2 className="font-display text-5xl leading-tight">{event.title}</h2> : null}
              {event.body ? (
                <Paragraphs text={event.body} className="font-[family-name:var(--font-text)] text-xl leading-relaxed" />
              ) : null}
            </Centered>
          ),
        });
      });
    }

    if (block === "contributions") {
      memory.contributions.forEach((item) => {
        slides.push({
          key: `co-${item.id}`,
          transition: "fade",
          backdrop: item.media[0]?.kind === "image" ? item.media[0] : undefined,
          content: (
            <Centered>
              <Paragraphs text={item.body} className="font-[family-name:var(--font-text)] text-2xl leading-[1.6]" />
              <p className="font-display text-2xl italic text-[var(--m-accent)]">{item.author}</p>
            </Centered>
          ),
        });
      });
    }
  }

  if (memory.closing) {
    slides.push({
      key: "closing",
      transition: "fade",
      content: (
        <Centered>
          <p className="font-display text-5xl leading-tight italic sm:text-6xl">{memory.closing}</p>
        </Centered>
      ),
    });
  }

  slides.push({
    key: "end",
    transition: "fade",
    content: (
      <div className="mx-auto grid max-h-[86dvh] w-full max-w-xl gap-12 overflow-y-auto px-6 py-8">
        <Seal memory={memory} seal={seal} />
        {after}
      </div>
    ),
  });

  return slides;
}

export function PagedExperience({
  memory,
  seal,
  mode,
  after,
  onReplay,
}: {
  memory: ViewMemory;
  seal: SealInfo;
  mode: "public" | "preview";
  after?: ReactNode;
  onReplay: () => void;
}) {
  const slides = useMemo(() => buildSlides(memory, seal, after), [memory, seal, after]);
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const slide = slides[index] ?? slides[0]!;
  const last = index === slides.length - 1;

  const go = useCallback(
    (delta: number) => setIndex((current) => Math.min(Math.max(current + delta, 0), slides.length - 1)),
    [slides.length],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, video")) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    if (last && mode === "public") track("experience_completed", { template: memory.template });
  }, [last, mode, memory.template]);

  const backdrop = slide.backdrop;
  const onBackdrop = Boolean(backdrop);

  return (
    <main
      className="relative h-dvh overflow-hidden select-none"
      onTouchStart={(event) => (touchStart.current = event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === null || end === undefined) return;
        if (Math.abs(end - start) > 50) go(end < start ? 1 : -1);
      }}
    >
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-3" aria-hidden="true">
        {slides.map((item, i) => (
          <span key={item.key} className="h-0.5 flex-1 overflow-hidden rounded-full bg-[var(--m-ink)]/15">
            <span
              className="block h-full bg-[var(--m-ink)]/70 transition-[width] duration-500"
              style={{ width: i <= index ? "100%" : "0%" }}
            />
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={slide.key}
          variants={variants[slide.transition]}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.9 }}
          aria-live="polite"
          className={`absolute inset-0 grid place-items-center ${onBackdrop ? "text-white" : ""}`}
        >
          {backdrop ? (
            <div className="absolute inset-0 overflow-hidden" aria-hidden={slide.content ? "true" : undefined}>
              <motion.img
                src={backdrop.src}
                alt={slide.content ? "" : backdrop.alt}
                className="h-full w-full object-cover"
                initial={{ scale: 1 }}
                animate={{ scale: slide.kenBurns ? 1.08 : 1 }}
                transition={{ duration: 12, ease: "linear" }}
              />
              {slide.content ? <div className="absolute inset-0 bg-black/45" /> : null}
            </div>
          ) : null}
          {slide.content ? <div className="relative z-10 w-full">{slide.content}</div> : null}
        </motion.section>
      </AnimatePresence>

      {!last ? (
        <>
          <button
            type="button"
            aria-label={t.experience.previous}
            onClick={() => go(-1)}
            className="absolute inset-y-0 left-0 z-10 w-1/4 cursor-w-resize focus-visible:bg-black/5"
            disabled={index === 0}
          />
          <button
            type="button"
            aria-label={t.experience.next}
            onClick={() => go(1)}
            className="absolute inset-y-0 right-0 z-10 w-1/4 cursor-e-resize focus-visible:bg-black/5"
          />
        </>
      ) : null}

      <div className={`absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-xs tracking-[0.2em] uppercase ${onBackdrop ? "text-white/85" : "text-[var(--m-muted)]"}`}>
        <span className="tabular-nums">
          {index + 1} / {slides.length}
        </span>
        {last ? (
          <button type="button" onClick={onReplay} className="underline-offset-4 hover:underline">
            {t.experience.replay}
          </button>
        ) : (
          <button type="button" onClick={() => go(1)} className="underline-offset-4 hover:underline">
            {t.experience.next}
          </button>
        )}
      </div>
    </main>
  );
}
