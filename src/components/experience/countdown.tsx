"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { THEMES } from "@/domain/presets";
import { fill, formatDate, t } from "@/lib/i18n";

// The offset between the server clock and the device clock is measured once,
// so changing the phone's time only changes what this counter shows. Content
// is never in the page: when the counter reaches zero the server is asked again.
export function Countdown({ releaseAt, serverNow, recipient }: { releaseAt: string; serverNow: string; recipient: string | null }) {
  const router = useRouter();
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  const target = new Date(releaseAt).getTime();
  const remaining = Math.max(0, target - now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(timer);
  }, [offset]);

  useEffect(() => {
    if (remaining === 0) {
      const timer = window.setTimeout(() => router.refresh(), 1500);
      return () => window.clearTimeout(timer);
    }
  }, [remaining, router]);

  const parts = [
    { value: Math.floor(remaining / 86_400_000), label: t.experience.scheduled.units.days },
    { value: Math.floor(remaining / 3_600_000) % 24, label: t.experience.scheduled.units.hours },
    { value: Math.floor(remaining / 60_000) % 60, label: t.experience.scheduled.units.minutes },
    { value: Math.floor(remaining / 1000) % 60, label: t.experience.scheduled.units.seconds },
  ];

  const theme = THEMES.noite;

  return (
    <main
      style={{ ...theme.vars, colorScheme: "dark" } as CSSProperties}
      className="grid min-h-dvh place-items-center bg-[var(--m-bg)] px-6 text-center text-[var(--m-ink)]"
    >
      <div className="grid justify-items-center gap-10">
        <div className="grid gap-4">
          <h1 className="font-display text-5xl sm:text-6xl">
            {remaining === 0 ? t.experience.scheduled.ready : t.experience.scheduled.title}
          </h1>
          <p className="mx-auto max-w-sm text-[var(--m-muted)]">{t.experience.scheduled.body}</p>
          {recipient ? (
            <p className="text-[0.72rem] tracking-[0.3em] text-[var(--m-accent)] uppercase">
              {fill(t.experience.scheduled.for, { name: recipient })}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-4 gap-3 sm:gap-6" role="timer" aria-live="off">
          {parts.map((part) => (
            <div key={part.label} className="grid min-w-16 gap-1 sm:min-w-20">
              <span className="font-display text-5xl tabular-nums sm:text-6xl">{String(part.value).padStart(2, "0")}</span>
              <span className="text-[0.65rem] tracking-[0.2em] text-[var(--m-muted)] uppercase">{part.label}</span>
            </div>
          ))}
        </div>

        <p className="text-sm text-[var(--m-muted)]">
          {fill(t.experience.scheduled.opensAt, { date: formatDate(releaseAt, "datetime") })}
        </p>
      </div>
    </main>
  );
}
