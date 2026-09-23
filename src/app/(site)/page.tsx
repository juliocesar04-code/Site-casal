import { createHash } from "node:crypto";
import { PageView } from "@/components/site/page-view";
import { PhoneDemo } from "@/components/site/demo";
import { TemplateMiniature } from "@/components/site/template-miniature";
import { LinkButton } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { DEFAULT_PRODUCT, formatPrice, PRODUCTS } from "@/domain/catalog";
import { TEMPLATE_IDS } from "@/domain/presets";
import { fill, t } from "@/lib/i18n";

const price = formatPrice(PRODUCTS[DEFAULT_PRODUCT].amountCents);
// A real digest of a real sentence, shown as an example of the seal.
const sampleHash = createHash("sha256").update(t.site.closing.title).digest("hex");

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-[0.72rem] font-medium tracking-[0.24em] uppercase ${light ? "text-brass-2" : "text-brass"}`}>
      {children}
    </p>
  );
}

function SectionTitle({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2 className={`font-display text-[2.35rem] leading-[1.05] sm:text-5xl ${light ? "text-paper" : "text-ink"}`}>
      {children}
    </h2>
  );
}

export default function LandingPage() {
  return (
    <main>
      <PageView />

      <section className="grain overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:pt-24 md:pb-28">
          <div className="grid gap-7">
            <h1 className="font-display text-[3.1rem] leading-[0.98] text-ink sm:text-7xl lg:text-[5.4rem]">
              {t.site.hero.title}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-2">{t.site.hero.lead}</p>
            <div className="flex flex-wrap items-center gap-3">
              <LinkButton href="/criar-conta" size="lg">
                {t.site.hero.primary}
              </LinkButton>
              <LinkButton href="#demonstracao" variant="secondary" size="lg">
                {t.site.hero.secondary}
              </LinkButton>
            </div>
            <p className="text-sm text-muted">{fill(t.site.hero.price, { price })}</p>
          </div>
          <div id="demonstracao" className="scroll-mt-24">
            <PhoneDemo />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-20">
          <div className="grid content-start gap-4">
            <Eyebrow>{t.site.demo.eyebrow}</Eyebrow>
            <SectionTitle>{t.site.demo.title}</SectionTitle>
          </div>
          <p className="self-end text-lg leading-relaxed text-ink-2">{t.site.demo.lead}</p>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-4">
            <Eyebrow>{t.site.how.eyebrow}</Eyebrow>
            <SectionTitle>{t.site.how.title}</SectionTitle>
          </div>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {t.site.how.steps.map((step, index) => (
              <li key={step.title} className="grid content-start gap-4 bg-paper p-7">
                <span className="font-display text-4xl text-brass">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-medium text-ink">{step.title}</h3>
                <p className="text-[0.95rem] leading-relaxed text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="modelos" className="scroll-mt-20 bg-night text-paper">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid max-w-2xl gap-4">
            <Eyebrow light>{t.site.templates.eyebrow}</Eyebrow>
            <SectionTitle light>{t.site.templates.title}</SectionTitle>
            <p className="text-lg leading-relaxed text-paper/70">{t.site.templates.lead}</p>
          </div>
          <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 lg:grid-cols-3">
            {TEMPLATE_IDS.map((id) => (
              <li key={id} className="grid gap-4">
                <TemplateMiniature id={id} />
                <div className="grid gap-1.5">
                  <h3 className="font-display text-xl sm:text-2xl">{t.site.templates.items[id].name}</h3>
                  <p className="text-[0.8rem] leading-relaxed text-paper/65 sm:text-sm">{t.site.templates.items[id].body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-4">
            <Eyebrow>{t.site.uses.eyebrow}</Eyebrow>
            <SectionTitle>{t.site.uses.title}</SectionTitle>
          </div>
          <ul className="mt-10 flex flex-wrap gap-2.5">
            {t.site.uses.items.map((item) => (
              <li key={item} className="rounded-full border border-line bg-card px-4 py-2 text-sm text-ink-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-line bg-paper-2">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid content-start gap-5">
            <Eyebrow>{t.site.collaboration.eyebrow}</Eyebrow>
            <SectionTitle>{t.site.collaboration.title}</SectionTitle>
            <p className="text-lg leading-relaxed text-ink-2">{t.site.collaboration.body}</p>
            <ul className="mt-2 grid gap-3">
              {t.site.collaboration.points.map((point) => (
                <li key={point} className="flex gap-3 text-[0.95rem] text-ink-2">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
            <article id="qr" className="grid content-start gap-5 rounded-2xl bg-card p-7 shadow-[var(--shadow-float)]">
              <Eyebrow>{t.site.qr.eyebrow}</Eyebrow>
              <h3 className="font-display text-3xl leading-tight">{t.site.qr.title}</h3>
              <p className="text-[0.95rem] leading-relaxed text-ink-2">{t.site.qr.body}</p>
              <div className="mt-2 grid justify-items-center gap-3 rounded-xl border border-dashed border-line p-6 text-center">
                <QrSketch />
                <p className="font-display text-lg italic">{t.site.qr.card}</p>
              </div>
            </article>
            <article className="grid content-start gap-5 rounded-2xl bg-night p-7 text-paper shadow-[var(--shadow-float)]">
              <Eyebrow light>{t.site.schedule.eyebrow}</Eyebrow>
              <h3 className="font-display text-3xl leading-tight">{t.site.schedule.title}</h3>
              <p className="text-[0.95rem] leading-relaxed text-paper/70">{t.site.schedule.body}</p>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center" aria-hidden="true">
                {[
                  ["12", "dias"],
                  ["07", "horas"],
                  ["41", "min"],
                  ["09", "seg"],
                ].map(([value, unit]) => (
                  <div key={unit} className="grid gap-1 rounded-lg border border-white/10 py-3">
                    <span className="font-display text-3xl tabular-nums">{value}</span>
                    <span className="text-[0.6rem] tracking-[0.2em] text-paper/50 uppercase">{unit}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="privacidade" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-4">
            <Eyebrow>{t.site.privacy.eyebrow}</Eyebrow>
            <SectionTitle>{t.site.privacy.title}</SectionTitle>
          </div>
          <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {t.site.privacy.points.map((point) => (
              <div key={point.title} className="grid content-start gap-2 border-t border-line pt-6">
                <h3 className="text-lg font-medium">{point.title}</h3>
                <p className="leading-relaxed text-ink-2">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-night text-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:py-28">
          <div className="grid content-start gap-5">
            <Eyebrow light>{t.site.security.eyebrow}</Eyebrow>
            <SectionTitle light>{t.site.security.title}</SectionTitle>
            <p className="text-lg leading-relaxed text-paper/70">{t.site.security.body}</p>
          </div>
          <div className="grid content-start gap-6">
            <div aria-hidden="true" className="rounded-2xl border border-white/10 p-6 font-mono text-xs leading-relaxed break-all text-paper/60">
              <span className="text-brass-2">sha256</span> {sampleHash}
            </div>
            <ul className="grid gap-3">
              {t.site.security.points.map((point) => (
                <li key={point} className="flex gap-3 text-paper/80">
                  <LogoMark className="mt-0.5 h-4 w-4 shrink-0 text-brass-2" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="duvidas" className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-[0.8fr_1.2fr] md:py-28">
          <div className="grid content-start gap-4">
            <Eyebrow>{t.site.faq.eyebrow}</Eyebrow>
            <SectionTitle>{t.site.faq.title}</SectionTitle>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {t.site.faq.items.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-muted transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl leading-relaxed text-ink-2">{fill(item.a, { price })}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="grain border-t border-line bg-paper-2">
        <div className="mx-auto grid max-w-6xl justify-items-center gap-8 px-4 py-24 text-center sm:px-6 md:py-32">
          <LogoMark className="h-10 w-10 text-brass" />
          <h2 className="max-w-2xl font-display text-5xl leading-[1.02] sm:text-6xl">{t.site.closing.title}</h2>
          <LinkButton href="/criar-conta" size="lg">
            {t.site.closing.cta}
          </LinkButton>
        </div>
      </section>
    </main>
  );
}

function QrSketch() {
  const cells = [
    "1111111010111",
    "1000001011001",
    "1011101001101",
    "1011101110101",
    "1011101010011",
    "1000001001101",
    "1111111010101",
    "0000000011000",
    "1101011100110",
    "0110100011011",
    "1011011101001",
    "0100110010110",
    "1110101101011",
  ];
  return (
    <svg viewBox="0 0 13 13" className="h-24 w-24" aria-hidden="true" shapeRendering="crispEdges">
      {cells.flatMap((row, y) =>
        [...row].map((cell, x) => (cell === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#171513" /> : null)),
      )}
    </svg>
  );
}
