"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

type Props = {
  memoryId: string;
  action: (memoryId: string, confirmation: string) => Promise<{ ok: boolean; error?: string }>;
  redirectTo?: string;
  trigger?: React.ReactNode;
};

export function DeleteDialog({ memoryId, action, redirectTo, trigger }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const confirmed = value.trim().toUpperCase() === t.delete.confirmWord;

  const close = () => {
    dialog.current?.close();
    setValue("");
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="text-sm text-danger underline-offset-4 hover:underline"
      >
        {trigger ?? t.dashboard.actions.delete}
      </button>
      <dialog
        ref={dialog}
        onClose={close}
        aria-labelledby={`delete-${memoryId}`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-0 text-ink shadow-[var(--shadow-float)] backdrop:bg-night/50 backdrop:backdrop-blur-sm"
      >
        <form
          className="grid gap-5 p-6 sm:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirmed) return;
            start(async () => {
              const result = await action(memoryId, value);
              if (!result.ok) {
                setError(t.errors[(result.error ?? "generic") as keyof typeof t.errors] ?? t.errors.generic);
                return;
              }
              close();
              if (redirectTo) router.push(redirectTo);
              router.refresh();
            });
          }}
        >
          <h2 id={`delete-${memoryId}`} className="font-display text-3xl">
            {t.delete.title}
          </h2>
          <p className="leading-relaxed text-ink-2">{t.delete.body}</p>
          <label className="grid gap-2 text-sm">
            <span className="font-medium text-ink-2">{t.delete.confirmLabel}</span>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="rounded-xl border border-line bg-paper px-4 py-3 tracking-widest focus:border-ink/50 focus:outline-none"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={close}>
              {t.delete.cancel}
            </Button>
            <Button type="submit" variant="danger" disabled={!confirmed || pending}>
              {t.delete.submit}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
