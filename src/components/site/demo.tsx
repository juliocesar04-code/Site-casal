"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

type Stage = "gate" | "name" | "chapter";

// A self-contained miniature of the real experience, with sample text only.
export function PhoneDemo() {
  const [stage, setStage] = useState<Stage>("gate");

  useEffect(() => {
    if (stage !== "name") return;
    const timer = window.setTimeout(() => setStage("chapter"), 3200);
    return () => window.clearTimeout(timer);
  }, [stage]);

  return (
    <figure className="relative mx-auto w-full max-w-[19rem]">
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2.6rem] border-[10px] border-night bg-[#0f0f10] text-[#efeae2] shadow-[0_40px_80px_-30px_rgb(23_21_19/0.55)]">
        <div className="absolute top-2 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-night" aria-hidden="true" />
        <AnimatePresence mode="wait">
          {stage === "gate" ? (
            <motion.div
              key="gate"
              className="absolute inset-0 grid place-items-center px-7 text-center"
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.7 }}
            >
              <div className="grid justify-items-center gap-7">
                <p className="font-display text-[1.75rem] leading-[1.08]">{t.site.demo.gate}</p>
                <p className="text-[0.6rem] tracking-[0.3em] text-[#9a948b] uppercase">{t.site.demo.recipient}</p>
                <button
                  type="button"
                  onClick={() => setStage("name")}
                  className="h-11 rounded-full border border-white/30 px-7 text-[0.7rem] tracking-[0.28em] uppercase transition-colors hover:border-[#c9a86a] hover:bg-[#c9a86a] hover:text-[#0f0f10]"
                >
                  {t.site.demo.open}
                </button>
              </div>
            </motion.div>
          ) : null}

          {stage === "name" ? (
            <motion.div
              key="name"
              className="absolute inset-0 grid place-items-center px-7 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
            >
              <div className="grid gap-5">
                <motion.p
                  className="font-display text-5xl italic"
                  initial={{ letterSpacing: "0.1em", opacity: 0 }}
                  animate={{ letterSpacing: "-0.01em", opacity: 1 }}
                  transition={{ duration: 1.6 }}
                >
                  {t.site.demo.name}
                </motion.p>
                <motion.p
                  className="font-[family-name:var(--font-text)] text-base leading-relaxed text-[#9a948b]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.1, delay: 1.1 }}
                >
                  {t.site.demo.opening}
                </motion.p>
              </div>
            </motion.div>
          ) : null}

          {stage === "chapter" ? (
            <motion.div
              key="chapter"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            >
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(120%_80%_at_30%_20%,#d9b27c_0%,#8a5a3b_38%,#2a1b14_75%)]"
                initial={{ scale: 1 }}
                animate={{ scale: 1.1 }}
                transition={{ duration: 10, ease: "linear" }}
              />
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative grid h-full content-end gap-3 px-6 pb-14">
                <p className="text-[0.6rem] tracking-[0.25em] text-[#e6cf9f] uppercase">{t.site.demo.chapter}</p>
                <p className="font-display text-3xl leading-tight">{t.site.demo.chapterTitle}</p>
                <p className="font-[family-name:var(--font-text)] text-sm leading-relaxed text-white/85">
                  {t.site.demo.chapterBody}
                </p>
                <button
                  type="button"
                  onClick={() => setStage("gate")}
                  className="mt-3 justify-self-start text-[0.65rem] tracking-[0.2em] text-white/70 uppercase underline-offset-4 hover:underline"
                >
                  {t.site.demo.replay}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <figcaption className="mt-4 text-center text-xs tracking-[0.2em] text-muted uppercase">{t.site.demo.label}</figcaption>
    </figure>
  );
}
