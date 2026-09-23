"use client";

import { motion } from "motion/react";
import type { ViewMedia, ViewMemory } from "@/domain/snapshot";
import { fill, formatDate, t } from "@/lib/i18n";

export function MediaView({ media, className = "", cover = false }: { media: ViewMedia; className?: string; cover?: boolean }) {
  const fit = cover ? "h-full w-full object-cover" : "h-auto w-full";
  if (media.kind === "video") {
    return (
      <video
        className={`${fit} bg-black/5 ${className}`}
        src={media.src}
        poster={media.poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        aria-label={media.alt || undefined}
      />
    );
  }
  return (
    <img
      className={`${fit} ${className}`}
      src={media.src}
      alt={media.alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading="lazy"
      decoding="async"
    />
  );
}

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/\n{2,}/).filter((part) => part.trim().length > 0);
  return (
    <div className={className}>
      {parts.map((part, index) => (
        <p key={index} className="whitespace-pre-line [&:not(:first-child)]:mt-[1.1em]">
          {part}
        </p>
      ))}
    </div>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.7rem] font-medium tracking-[0.22em] text-[var(--m-accent)] uppercase">{children}</p>
  );
}

export function MessageBlock({ memory, letter = false }: { memory: ViewMemory; letter?: boolean }) {
  if (!memory.message) return null;
  return (
    <Reveal
      className={
        letter
          ? "mx-auto max-w-[36rem] rounded-sm bg-[var(--m-surface)] px-7 py-10 shadow-[0_30px_60px_-40px_rgb(0_0_0/0.35)] sm:px-12 sm:py-14"
          : "mx-auto max-w-[34rem]"
      }
    >
      {letter && memory.recipient ? (
        <p className="mb-8 font-display text-3xl italic">{memory.recipient},</p>
      ) : null}
      <Paragraphs text={memory.message} className="font-[family-name:var(--font-text)] text-[1.2rem] leading-[1.75] sm:text-[1.3rem]" />
      {letter && memory.sender ? <p className="mt-10 text-right font-display text-2xl italic">{memory.sender}</p> : null}
    </Reveal>
  );
}

export function GalleryBlock({ items }: { items: ViewMedia[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={t.experience.gallery} className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 sm:gap-6">
      {items.map((media, index) => (
        <Reveal
          key={media.id}
          delay={(index % 2) * 0.08}
          className={`overflow-hidden rounded-sm ${index % 3 === 0 ? "sm:col-span-2" : ""}`}
        >
          <MediaView media={media} />
        </Reveal>
      ))}
    </section>
  );
}

export function ChaptersBlock({ chapters }: { chapters: ViewMemory["sections"] }) {
  if (chapters.length === 0) return null;
  return (
    <div className="grid gap-24 sm:gap-32">
      {chapters.map((chapter, index) => (
        <article key={chapter.id} className="mx-auto grid w-full max-w-3xl gap-8">
          <Reveal className="grid gap-3 text-center">
            <Kicker>{fill(t.experience.chapter, { n: index + 1 })}</Kicker>
            {chapter.title ? <h2 className="font-display text-4xl leading-tight sm:text-5xl">{chapter.title}</h2> : null}
            {chapter.date ? <p className="text-sm text-[var(--m-muted)]">{formatDate(chapter.date)}</p> : null}
          </Reveal>
          {chapter.media.map((media) => (
            <Reveal key={media.id} className="overflow-hidden rounded-sm">
              <MediaView media={media} />
            </Reveal>
          ))}
          {chapter.body ? (
            <Reveal className="mx-auto max-w-[34rem]">
              <Paragraphs text={chapter.body} className="font-[family-name:var(--font-text)] text-[1.15rem] leading-[1.75]" />
            </Reveal>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function TimelineBlock({ events }: { events: ViewMemory["timeline"] }) {
  if (events.length === 0) return null;
  return (
    <section aria-label={t.experience.timeline} className="mx-auto w-full max-w-2xl">
      <Reveal className="mb-12 text-center">
        <Kicker>{t.experience.timeline}</Kicker>
      </Reveal>
      <ol className="relative grid gap-14 border-l border-[var(--m-line)] pl-8 sm:pl-12">
        {events.map((event) => (
          <li key={event.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute top-2 -left-[calc(2rem+4.5px)] h-2.5 w-2.5 rounded-full bg-[var(--m-accent)] sm:-left-[calc(3rem+4.5px)]"
            />
            <Reveal className="grid gap-3">
              {event.date ? (
                <time dateTime={event.date} className="text-sm tracking-wide text-[var(--m-muted)]">
                  {formatDate(event.date)}
                </time>
              ) : null}
              {event.title ? <h3 className="font-display text-3xl leading-tight">{event.title}</h3> : null}
              {event.media ? (
                <div className="mt-2 overflow-hidden rounded-sm">
                  <MediaView media={event.media} />
                </div>
              ) : null}
              {event.body ? (
                <Paragraphs text={event.body} className="font-[family-name:var(--font-text)] text-[1.08rem] leading-relaxed" />
              ) : null}
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ContributionsBlock({ items }: { items: ViewMemory["contributions"] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={t.experience.contributions} className="mx-auto w-full max-w-4xl">
      <Reveal className="mb-12 text-center">
        <Kicker>{t.experience.contributions}</Kicker>
      </Reveal>
      <div className={`gap-6 [&>*]:mb-6 ${items.length > 1 ? "columns-1 sm:columns-2" : "mx-auto max-w-xl"}`}>
        {items.map((item, index) => (
          <Reveal key={item.id} delay={(index % 2) * 0.06} className="break-inside-avoid">
            <figure className="rounded-sm border border-[var(--m-line)] bg-[var(--m-surface)] p-6 sm:p-8">
              {item.media.map((media) => (
                <div key={media.id} className="mb-5 overflow-hidden rounded-sm">
                  <MediaView media={media} />
                </div>
              ))}
              <blockquote>
                <Paragraphs text={item.body} className="font-[family-name:var(--font-text)] text-[1.08rem] leading-relaxed" />
              </blockquote>
              <figcaption className="mt-5 font-display text-xl italic text-[var(--m-accent)]">{item.author}</figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export type SealInfo = {
  slug: string | null;
  publishedAt: string | null;
  hash: string | null;
  intact: boolean;
};

export function Seal({ memory, seal }: { memory: ViewMemory; seal: SealInfo }) {
  const recipient = memory.recipient ?? "";
  return (
    <footer className="mx-auto grid max-w-md justify-items-center gap-2 text-center text-xs leading-relaxed text-[var(--m-muted)]">
      <svg viewBox="0 0 32 32" className="mb-2 h-8 w-8 text-[var(--m-accent)]" aria-hidden="true" fill="none">
        <ellipse cx="16" cy="17" rx="9.5" ry="11" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="16" cy="5" r="1.4" fill="currentColor" />
      </svg>
      <p>
        {memory.sender
          ? fill(t.experience.seal.createdBy, { sender: memory.sender, recipient })
          : fill(t.experience.seal.createdFor, { recipient })}
      </p>
      {seal.publishedAt ? <p>{fill(t.experience.seal.published, { date: formatDate(seal.publishedAt) })}</p> : null}
      {seal.slug ? <p className="font-mono tracking-wider">{fill(t.experience.seal.id, { id: seal.slug })}</p> : null}
      {seal.intact && seal.hash ? (
        <p className="mt-1">
          {t.experience.seal.preserved}{" "}
          <span className="font-mono opacity-70" title={seal.hash}>
            {seal.hash.slice(0, 12)}
          </span>
        </p>
      ) : null}
    </footer>
  );
}
