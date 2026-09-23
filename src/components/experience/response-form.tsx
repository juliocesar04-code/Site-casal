"use client";

import { useActionState } from "react";
import type { ResponseState } from "@/app/m/[slug]/actions";
import { t } from "@/lib/i18n";

type Props = {
  action: (state: ResponseState, form: FormData) => Promise<ResponseState>;
  disabled?: boolean;
};

const field =
  "w-full rounded-lg border border-[var(--m-line)] bg-[var(--m-surface)] px-4 py-3 text-[var(--m-ink)] placeholder:text-[var(--m-muted)] focus:border-[var(--m-accent)] focus:outline-none";

export function ResponseForm({ action, disabled = false }: Props) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });

  if (state.status === "sent") {
    return <p className="text-center font-display text-2xl italic" role="status">{t.experience.response.sent}</p>;
  }

  const errorKey = (state.error ?? "generic") as keyof typeof t.errors;

  return (
    <form action={submit} className="mx-auto grid w-full max-w-md gap-4">
      <div className="grid gap-1 text-center">
        <h2 className="font-display text-3xl">{t.experience.response.title}</h2>
        <p className="text-sm text-[var(--m-muted)]">{t.experience.response.lead}</p>
      </div>
      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--m-muted)]">{t.experience.response.name}</span>
        <input name="author" maxLength={80} autoComplete="name" className={field} disabled={disabled} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--m-muted)]">{t.experience.response.body}</span>
        <textarea name="body" required maxLength={2000} rows={4} className={`${field} resize-y`} disabled={disabled} />
      </label>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t.errors[errorKey] ?? t.errors.generic}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || disabled}
        className="h-12 rounded-full bg-[var(--m-ink)] px-6 text-sm font-medium text-[var(--m-bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {t.experience.response.submit}
      </button>
    </form>
  );
}
