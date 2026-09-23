"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Saver<P> = (patch: P) => Promise<{ ok: boolean; error?: string }>;

// Accumulates field changes and sends them together after a pause in typing.
// `flush` forces the pending patch out, used before leaving a step.
export function useAutosave<P extends Record<string, unknown>>(save: Saver<Partial<P>>, delay = 700) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Partial<P>>({});
  const timer = useRef<number | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const send = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) await inFlight.current;
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setStatus("saving");

    inFlight.current = (async () => {
      const result = await save(patch).catch(() => ({ ok: false, error: "generic" }));
      if (result.ok) {
        setStatus("saved");
        setError(null);
      } else {
        // Put the patch back so the next change retries it.
        pending.current = { ...patch, ...pending.current };
        setStatus("error");
        setError(result.error ?? "generic");
      }
    })();
    await inFlight.current;
    inFlight.current = null;
  }, [save]);

  const queue = useCallback(
    (patch: Partial<P>) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void send(), delay);
    },
    [delay, send],
  );

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  return { status, error, queue, flush: send };
}
