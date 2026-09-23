"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string | null;
  counter?: { value: number; max: number };
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

export function FieldShell({ label, hint, error, counter, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {label}
        </label>
        {counter ? (
          <span
            className={`text-xs tabular-nums ${counter.value > counter.max ? "text-danger" : "text-muted"}`}
            aria-hidden="true"
          >
            {counter.value}/{counter.max}
          </span>
        ) : null}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-card px-4 py-3 text-[0.97rem] text-ink placeholder:text-muted/70 shadow-[inset_0_1px_0_rgb(23_21_19/0.02)] transition-colors duration-200 hover:border-ink/25 focus:border-ink/50 focus:outline-none aria-[invalid=true]:border-danger";

type InputFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  hint?: string;
  error?: string | null;
  showCounter?: boolean;
};

export function InputField({ label, hint, error, showCounter, className = "", ...props }: InputFieldProps) {
  const length = typeof props.value === "string" ? props.value.length : 0;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      counter={showCounter && props.maxLength ? { value: length, max: props.maxLength } : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${inputClass} ${className}`}
          {...props}
        />
      )}
    </FieldShell>
  );
}

type TextareaFieldProps = Omit<ComponentProps<"textarea">, "id"> & {
  label: string;
  hint?: string;
  error?: string | null;
  showCounter?: boolean;
};

export function TextareaField({ label, hint, error, showCounter, className = "", ...props }: TextareaFieldProps) {
  const length = typeof props.value === "string" ? props.value.length : 0;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      counter={showCounter && props.maxLength ? { value: length, max: props.maxLength } : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${inputClass} min-h-32 resize-y leading-relaxed ${className}`}
          {...props}
        />
      )}
    </FieldShell>
  );
}
