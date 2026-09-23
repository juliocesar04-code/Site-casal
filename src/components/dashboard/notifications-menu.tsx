"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NotificationItem } from "@/server/notifications/outbox";
import { formatRelative, t } from "@/lib/i18n";

export function NotificationsMenu({ items, onOpen }: { items: NotificationItem[]; onOpen: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((item) => !item.read_at).length;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen(!open);
          if (!open && unread > 0) void onOpen();
        }}
        className="relative rounded-full px-3 py-2 text-ink-2 hover:bg-ink/5 hover:text-ink"
      >
        {t.dashboard.notifications}
        {unread > 0 ? (
          <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-brass px-1 text-[0.65rem] font-semibold text-white tabular-nums">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-float)]">
          {items.length === 0 ? (
            <p className="p-5 text-sm text-muted">{t.dashboard.noNotifications}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.memory_id ? `/painel/memorias/${item.memory_id}` : "/painel"}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 p-4 text-sm hover:bg-paper"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.read_at ? "bg-line" : "bg-brass"}`}
                    />
                    <span className="grid gap-0.5">
                      <span className="text-ink">{t.notifications.types[item.type]}</span>
                      <span className="text-xs text-muted">{formatRelative(item.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
