type Document = {
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; paragraphs: string[] }[];
};

export function LegalDocument({ document, contactEmail }: { document: Document; contactEmail: string | null }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="grid gap-4 border-b border-line pb-10">
        <h1 className="font-display text-5xl leading-tight sm:text-6xl">{document.title}</h1>
        <p className="text-sm text-muted">Atualizado em {document.updated}</p>
        <p className="text-lg leading-relaxed text-ink-2">{document.intro}</p>
      </header>
      <div className="grid gap-10 pt-10">
        {document.sections.map((section) => (
          <section key={section.title} className="grid gap-3">
            <h2 className="font-display text-3xl">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="leading-relaxed text-ink-2">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        {contactEmail ? (
          <section className="grid gap-3 border-t border-line pt-10">
            <h2 className="font-display text-3xl">Contato</h2>
            <p className="text-ink-2">
              <a href={`mailto:${contactEmail}`} className="underline underline-offset-4">
                {contactEmail}
              </a>
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
