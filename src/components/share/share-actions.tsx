"use client";

import { useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics-client";
import { t } from "@/lib/i18n";

type Props = { url: string; compact?: boolean };

const noop = () => () => {};

export function ShareActions({ url, compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  // False on the server and during hydration, so both render the same markup.
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );
  const text = t.published.shareText;
  const pill =
    "inline-flex h-10 items-center justify-center rounded-full border border-line bg-card px-4 text-sm text-ink-2 transition-colors hover:border-ink/30 hover:text-ink";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("share_clicked", { channel: "copy" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t.published.link, url);
    }
  };

  const native = async () => {
    try {
      await navigator.share({ title: text, text, url });
      track("share_clicked", { channel: "native" });
    } catch {
      // dismissed
    }
  };

  const encoded = encodeURIComponent(`${text} ${url}`);

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className={pill} aria-live="polite">
        {copied ? t.published.copied : compact ? t.dashboard.actions.copy : t.published.copy}
      </button>
      <a
        className={pill}
        href={`https://wa.me/?text=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("share_clicked", { channel: "whatsapp" })}
      >
        {t.published.whatsapp}
      </a>
      {!compact ? (
        <a
          className={pill}
          href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("share_clicked", { channel: "telegram" })}
        >
          {t.published.telegram}
        </a>
      ) : null}
      {canShare ? (
        <button type="button" onClick={native} className={pill}>
          {t.published.share}
        </button>
      ) : null}
    </div>
  );
}
