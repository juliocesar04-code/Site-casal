"use client";

import { useState } from "react";
import { uploadFile, UploadError, kindOf } from "@/components/editor/upload-client";
import { Button } from "@/components/ui/button";
import { InputField, TextareaField } from "@/components/ui/field";
import { t } from "@/lib/i18n";

type State = "idle" | "sending" | "sent";

export function ContributionForm({ token }: { token: string }) {
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <div className="grid gap-2 rounded-2xl border border-line bg-card p-6" role="status">
        <h2 className="font-display text-3xl">{t.contribute.sent.title}</h2>
        <p className="text-ink-2">{t.contribute.sent.body}</p>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const kind = file ? kindOf(file) : null;
    if (file && !kind) {
      setError(t.editor.upload.reasons.invalid_file);
      return;
    }
    setState("sending");

    try {
      let slot: { mediaId: string; uploadUrl: string; posterUploadUrl: string | null; ticket: string } | null = null;
      const response = await fetch(`/api/contribuir/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          author,
          body,
          media: file && kind ? { kind, mime: file.type, size: file.size } : null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; upload?: typeof slot };
      if (!response.ok) throw new UploadError(data.error ?? "generic");
      slot = data.upload ?? null;

      if (file && slot) {
        const issued = slot;
        await uploadFile(file, {
          requestSlot: async () => issued,
          completePath: `/api/contribuir/${token}/complete`,
        }).catch(() => undefined);
      }
      setState("sent");
    } catch (caught) {
      const code = caught instanceof UploadError ? caught.code : "generic";
      setError(t.errors[code as keyof typeof t.errors] ?? t.errors.generic);
      setState("idle");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <InputField
        label={t.contribute.name}
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        maxLength={80}
        required
        autoComplete="name"
      />
      <TextareaField
        label={t.contribute.body}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        showCounter
        required
        rows={6}
      />
      <label className="grid gap-2 text-sm">
        <span className="font-medium text-ink-2">{t.contribute.media}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-paper"
        />
        <span className="text-xs text-muted">{t.contribute.mediaHint}</span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={state === "sending"}>
        {state === "sending" ? t.contribute.sending : t.contribute.submit}
      </Button>
    </form>
  );
}
