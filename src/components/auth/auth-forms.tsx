"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/field";
import { fill, t } from "@/lib/i18n";

type Action = (state: AuthState, form: FormData) => Promise<AuthState>;

const messages: Record<string, string> = {
  invalid: t.auth.signIn.invalid,
  unconfirmed: t.auth.signIn.unconfirmed,
  rateLimited: t.auth.errors.rateLimited,
  weakPassword: t.auth.errors.weakPassword,
  invalidEmail: t.auth.errors.invalidEmail,
  linkExpired: t.auth.errors.linkExpired,
  generic: t.auth.errors.generic,
};

function ErrorLine({ state }: { state: AuthState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="rounded-lg bg-danger/8 px-4 py-3 text-sm text-danger">
      {messages[state.message ?? "generic"] ?? messages.generic}
    </p>
  );
}

export function SignInForm({ action, next }: { action: Action; next: string }) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });
  const [values, setValues] = useState({ email: "", password: "" });
  return (
    <form action={submit} className="grid gap-5">
      <input type="hidden" name="next" value={next} />
      <InputField
        label={t.auth.fields.email}
        name="email"
        type="email"
        autoComplete="email"
        required
        value={values.email}
        onChange={(e) => setValues({ ...values, email: e.target.value })}
      />
      <InputField
        label={t.auth.fields.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={values.password}
        onChange={(e) => setValues({ ...values, password: e.target.value })}
      />
      <div className="-mt-2 text-right">
        <Link href="/recuperar-senha" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {t.auth.signIn.forgot}
        </Link>
      </div>
      <ErrorLine state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {t.auth.signIn.submit}
      </Button>
    </form>
  );
}

export function SignUpForm({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });
  const [values, setValues] = useState({ name: "", email: "", password: "" });

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-xl border border-line bg-card p-6 leading-relaxed text-ink-2">
        {fill(t.auth.signUp.sent, { email: state.email ?? "" })}
      </p>
    );
  }

  return (
    <form action={submit} className="grid gap-5">
      <InputField
        label={t.auth.fields.name}
        name="name"
        autoComplete="name"
        maxLength={80}
        value={values.name}
        onChange={(e) => setValues({ ...values, name: e.target.value })}
      />
      <InputField
        label={t.auth.fields.email}
        name="email"
        type="email"
        autoComplete="email"
        required
        value={values.email}
        onChange={(e) => setValues({ ...values, email: e.target.value })}
      />
      <InputField
        label={t.auth.fields.password}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        maxLength={128}
        required
        hint={t.auth.errors.weakPassword}
        value={values.password}
        onChange={(e) => setValues({ ...values, password: e.target.value })}
      />
      <ErrorLine state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {t.auth.signUp.submit}
      </Button>
      <p className="text-xs leading-relaxed text-muted">
        {t.auth.signUp.consent.split(/(\{terms\}|\{privacy\})/).map((part, index) =>
          part === "{terms}" ? (
            <Link key={index} href="/termos" className="underline underline-offset-2">
              {t.auth.signUp.terms}
            </Link>
          ) : part === "{privacy}" ? (
            <Link key={index} href="/privacidade" className="underline underline-offset-2">
              {t.auth.signUp.privacy}
            </Link>
          ) : (
            part
          ),
        )}
      </p>
    </form>
  );
}

export function ForgotForm({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });
  const [value, setValue] = useState("");
  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-xl border border-line bg-card p-6 leading-relaxed text-ink-2">
        {t.auth.forgot.sent}
      </p>
    );
  }
  return (
    <form action={submit} className="grid gap-5">
      <InputField
        label={t.auth.fields.email}
        name="email"
        type="email"
        autoComplete="email"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <ErrorLine state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {t.auth.forgot.submit}
      </Button>
    </form>
  );
}

export function ResetForm({ action }: { action: Action }) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });
  const [value, setValue] = useState("");
  return (
    <form action={submit} className="grid gap-5">
      <InputField
        label={t.auth.fields.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        maxLength={128}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <ErrorLine state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {t.auth.reset.submit}
      </Button>
    </form>
  );
}
