"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <p>Algo não saiu como esperado.</p>
          <button type="button" onClick={reset}>
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
