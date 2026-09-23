"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { ViewMemory } from "@/domain/snapshot";
import { TEMPLATES, THEMES } from "@/domain/presets";
import { fill, t } from "@/lib/i18n";
import { track } from "@/lib/analytics-client";
import type { SealInfo } from "@/components/experience/blocks";
import { ScrollExperience } from "@/components/experience/scroll";
import { PagedExperience } from "@/components/experience/paged";

type Stage = "gate" | "intro" | "content";

export type ExperienceProps = {
  memory: ViewMemory;
  seal: SealInfo;
  mode: "public" | "preview";
  after?: ReactNode;
};

function Dust() {
  // A handful of slow specks; purely decorative and skipped with reduced motion.
  const specks = Array.from({ length: 14 }, (_, index) => ({
    left: `${(index * 37) % 100}%`,
    top: `${(index * 53) % 100}%`,
    delay: (index % 7) * 1.3,
    size: 1 + (index % 3),
  }));
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {specks.map((speck, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-[var(--m-accent)]"
          style={{ left: speck.left, top: speck.top, width: speck.size, height: speck.size }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 0.5, 0], y: -40 }}
          transition={{ duration: 9, delay: speck.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function Experience({ memory, seal, mode, after }: ExperienceProps) {
  const theme = THEMES[memory.theme];
  const template = TEMPLATES[memory.template];
  const [stage, setStage] = useState<Stage>("gate");

  const open = useCallback(() => {
    setStage("intro");
    if (mode === "public") track("memory_opened", { template: memory.template });
  }, [mode, memory.template]);

  useEffect(() => {
    if (stage !== "intro") return;
    const timer = window.setTimeout(() => setStage("content"), memory.opening ? 4200 : 2600);
    return () => window.clearTimeout(timer);
  }, [stage, memory.opening]);

  const style = { ...theme.vars, colorScheme: theme.scheme } as CSSProperties;

  return (
    <div style={style} className="relative min-h-dvh bg-[var(--m-bg)] text-[var(--m-ink)]">
      {mode === "preview" ? (
        <p className="sticky top-0 z-50 bg-[var(--m-ink)] px-4 py-2 text-center text-xs text-[var(--m-bg)]">
          {t.experience.preview.banner}
        </p>
      ) : null}

      <AnimatePresence mode="wait">
        {stage === "gate" ? (
          <motion.section
            key="gate"
            className="relative grid min-h-dvh place-items-center overflow-hidden px-6 text-center"
            exit={{ opacity: 0, scale: 1.02, filter: "blur(6px)" }}
            transition={{ duration: 0.9 }}
          >
            <Dust />
            <div className="relative grid justify-items-center gap-10">
              <motion.h1
                className="max-w-[18ch] font-display text-[2.6rem] leading-[1.05] sm:text-6xl"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.4, delay: 0.3 }}
              >
                {t.experience.gate.title}
              </motion.h1>
              {memory.recipient ? (
                <motion.p
                  className="text-[0.72rem] tracking-[0.3em] text-[var(--m-muted)] uppercase"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.2, delay: 1.1 }}
                >
                  {fill(t.experience.gate.for, { name: memory.recipient })}
                </motion.p>
              ) : null}
              <motion.button
                type="button"
                onClick={open}
                className="h-14 min-w-44 rounded-full border border-[var(--m-ink)]/30 px-10 text-sm font-medium tracking-[0.28em] uppercase transition-colors duration-500 hover:border-[var(--m-accent)] hover:bg-[var(--m-accent)] hover:text-[var(--m-bg)]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 1.8 }}
              >
                {t.experience.gate.open}
              </motion.button>
            </div>
          </motion.section>
        ) : null}

        {stage === "intro" ? (
          <motion.section
            key="intro"
            className="grid min-h-dvh cursor-pointer place-items-center px-6 text-center"
            onClick={() => setStage("content")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <div className="grid gap-8">
              {memory.recipient ? (
                <motion.p
                  className="font-display text-5xl italic sm:text-7xl"
                  initial={{ opacity: 0, letterSpacing: "0.08em" }}
                  animate={{ opacity: 1, letterSpacing: "-0.01em" }}
                  transition={{ duration: 2 }}
                >
                  {memory.recipient}
                </motion.p>
              ) : null}
              {memory.opening ? (
                <motion.p
                  className="mx-auto max-w-[28ch] font-[family-name:var(--font-text)] text-xl leading-relaxed text-[var(--m-muted)] sm:text-2xl"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.4, delay: 1.3 }}
                >
                  {memory.opening}
                </motion.p>
              ) : null}
            </div>
          </motion.section>
        ) : null}

        {stage === "content" ? (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
            {template.mode === "paged" ? (
              <PagedExperience memory={memory} seal={seal} mode={mode} after={after} onReplay={() => setStage("gate")} />
            ) : (
              <ScrollExperience memory={memory} seal={seal} mode={mode} after={after} onReplay={() => setStage("gate")} />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
