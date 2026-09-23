"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkoutAction, returnToDraftAction } from "@/app/painel/memorias/[id]/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function FrozenNotice({ memoryId, hasCredit }: { memoryId: string; hasCredit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fail = (code: string) => setError(t.errors[code as keyof typeof t.errors] ?? t.errors.generic);

  return (
    <main className="mx-auto grid max-w-2xl gap-8 px-4 py-14 sm:px-6">
      <Link href="/painel" className="text-sm text-muted hover:text-ink">
        ← {t.editor.back}
      </Link>
      <div className="grid gap-4">
        <h1 className="font-display text-5xl leading-tight">{t.editor.frozen.title}</h1>
        <p className="leading-relaxed text-ink-2">{t.editor.frozen.body}</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await checkoutAction(memoryId, true);
              if (!result.ok) return fail(result.error);
              if (result.data.kind === "redirect") window.location.assign(result.data.url);
              else router.push(`/painel/memorias/${memoryId}/publicada`);
            })
          }
        >
          {hasCredit ? t.editor.steps.publish.publishCredit : t.editor.frozen.pay}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await returnToDraftAction(memoryId);
              if (!result.ok) return fail(result.error);
              router.refresh();
            })
          }
        >
          {t.editor.frozen.action}
        </Button>
      </div>
    </main>
  );
}
