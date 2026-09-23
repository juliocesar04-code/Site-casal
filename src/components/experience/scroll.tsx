"use client";

import { motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { TEMPLATES } from "@/domain/presets";
import type { ViewMemory } from "@/domain/snapshot";
import { fill, t } from "@/lib/i18n";
import { track } from "@/lib/analytics-client";
import {
  ChaptersBlock,
  ContributionsBlock,
  GalleryBlock,
  MessageBlock,
  Reveal,
  Seal,
  TimelineBlock,
  type SealInfo,
} from "@/components/experience/blocks";

type Props = {
  memory: ViewMemory;
  seal: SealInfo;
  mode: "public" | "preview";
  after?: ReactNode;
  onReplay: () => void;
};

export function EndMark({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onVisible();
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible]);
  return <div ref={ref} aria-hidden="true" />;
}

export function ScrollExperience({ memory, seal, mode, after, onReplay }: Props) {
  const template = TEMPLATES[memory.template];
  const letter = memory.template === "carta";
  const hero = memory.template === "classico" || memory.template === "colaborativo" ? memory.gallery[0] : undefined;

  const blocks: Record<(typeof template.blocks)[number], ReactNode> = {
    message: <MessageBlock memory={memory} letter={letter} />,
    gallery: <GalleryBlock items={hero ? memory.gallery.slice(1) : memory.gallery} />,
    chapters: <ChaptersBlock chapters={memory.sections} />,
    timeline: <TimelineBlock events={memory.timeline} />,
    contributions: <ContributionsBlock items={memory.contributions} />,
  };

  return (
    <main className="pb-24">
      <header className="relative grid min-h-[88dvh] place-items-center overflow-hidden px-6 text-center">
        {hero ? (
          <motion.div
            aria-hidden="true"
            className="absolute inset-0"
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2.4 }}
          >
            {hero.kind === "image" ? (
              <img src={hero.src} alt="" className="h-full w-full object-cover" />
            ) : hero.poster ? (
              <img src={hero.poster} alt="" className="h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--m-bg)]/30 via-[var(--m-bg)]/55 to-[var(--m-bg)]" />
          </motion.div>
        ) : null}
        <div className="relative grid max-w-3xl gap-6">
          {memory.title ? (
            <motion.h1
              className="font-display text-[2.8rem] leading-[1.02] sm:text-7xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.3, delay: 0.3 }}
            >
              {memory.title}
            </motion.h1>
          ) : null}
          {memory.sender ? (
            <motion.p
              className="text-[0.72rem] tracking-[0.3em] text-[var(--m-muted)] uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2, delay: 1 }}
            >
              {fill(t.experience.from, { name: memory.sender })}
            </motion.p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-28 px-5 sm:gap-40 sm:px-8">
        {template.blocks.map((key) => (
          <div key={key}>{blocks[key]}</div>
        ))}

        {memory.closing ? (
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="font-display text-4xl leading-tight italic sm:text-5xl">{memory.closing}</p>
          </Reveal>
        ) : null}

        <div className="grid gap-16">
          <EndMark onVisible={() => mode === "public" && track("experience_completed", { template: memory.template })} />
          <Seal memory={memory} seal={seal} />
          {after}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0 });
                onReplay();
              }}
              className="text-xs tracking-[0.2em] text-[var(--m-muted)] uppercase underline-offset-4 hover:underline"
            >
              {t.experience.replay}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
