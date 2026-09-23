"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

// Never renders error details: the digest is enough to find the server log.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="grid justify-items-center gap-5">
        <h1 className="font-display text-5xl">{t.errors.generic}</h1>
        <Button onClick={reset}>{t.published.waiting.retry}</Button>
      </div>
    </main>
  );
}
