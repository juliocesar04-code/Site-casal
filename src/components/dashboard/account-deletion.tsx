"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

type Action = (state: { error: string | null }, form: FormData) => Promise<{ error: string | null }>;

export function AccountDeletion({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, { error: null });
  const [value, setValue] = useState("");
  const confirmed = value.trim().toUpperCase() === t.delete.confirmWord;

  return (
    <form action={submit} className="grid gap-4">
      <label className="grid gap-2 text-sm">
        <span className="font-medium text-ink-2">{t.account.delete.confirmLabel}</span>
        <input
          name="confirmation"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="rounded-xl border border-line bg-paper px-4 py-3 tracking-widest focus:border-ink/50 focus:outline-none"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="danger" disabled={!confirmed || pending} className="justify-self-start">
        {t.account.delete.action}
      </Button>
    </form>
  );
}
