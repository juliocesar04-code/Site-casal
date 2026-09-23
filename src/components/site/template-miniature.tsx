import type { TemplateId } from "@/domain/presets";

// Abstract layout sketches, one per template. No sample photos: shapes only.
export function TemplateMiniature({ id }: { id: TemplateId }) {
  const frame = "relative aspect-[4/5] overflow-hidden rounded-lg";

  switch (id) {
    case "classico":
      return (
        <div className={`${frame} bg-[#f4efe6] p-4`} aria-hidden="true">
          <div className="h-2/5 rounded-sm bg-[linear-gradient(135deg,#cdb89a,#8a6a3b)]" />
          <div className="mx-auto mt-4 h-2 w-3/4 rounded-full bg-[#1d1a16]/70" />
          <div className="mx-auto mt-2 h-1.5 w-1/2 rounded-full bg-[#1d1a16]/25" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="aspect-square rounded-sm bg-[#d8ccb8]" />
            <div className="aspect-square rounded-sm bg-[#c8b89f]" />
          </div>
        </div>
      );
    case "carta":
      return (
        <div className={`${frame} bg-[#ecdfcb] p-5`} aria-hidden="true">
          <div className="h-full rounded-sm bg-[#f7efe2] p-4 shadow-[0_12px_24px_-16px_rgb(0_0_0/0.4)]">
            <div className="h-2 w-1/3 rounded-full bg-[#2d2118]/60" />
            <div className="mt-4 grid gap-2">
              {[92, 86, 95, 70, 88, 60].map((w, i) => (
                <div key={i} className="h-1 rounded-full bg-[#2d2118]/25" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div className="mt-5 ml-auto h-2 w-1/4 rounded-full bg-[#9b4f2e]/60" />
          </div>
        </div>
      );
    case "historia":
      return (
        <div className={`${frame} bg-[#e7eaec] p-5`} aria-hidden="true">
          <div className="relative h-full border-l border-[#1b2127]/20 pl-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative mb-5">
                <span className="absolute top-0.5 -left-[1.2rem] h-2 w-2 rounded-full bg-[#3f5f78]" />
                <div className="h-1.5 w-1/4 rounded-full bg-[#1b2127]/30" />
                <div className="mt-1.5 h-2 w-2/3 rounded-full bg-[#1b2127]/70" />
                {i === 1 ? <div className="mt-2 h-10 rounded-sm bg-[#b7c3cc]" /> : null}
              </div>
            ))}
          </div>
        </div>
      );
    case "cinematico":
      return (
        <div className={`${frame} bg-[radial-gradient(120%_90%_at_70%_20%,#6d5a45,#1a1614_70%)]`} aria-hidden="true">
          <div className="absolute inset-x-3 top-3 flex gap-1">
            {[1, 1, 0, 0].map((on, i) => (
              <span key={i} className={`h-0.5 flex-1 rounded-full ${on ? "bg-white/80" : "bg-white/25"}`} />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-8 grid justify-items-center gap-2">
            <div className="h-2.5 w-2/3 rounded-full bg-white/85" />
            <div className="h-1.5 w-1/3 rounded-full bg-white/40" />
          </div>
        </div>
      );
    case "capitulos":
      return (
        <div className={`${frame} bg-[#161a15] p-5`} aria-hidden="true">
          {["I", "II", "III"].map((n, i) => (
            <div
              key={n}
              className="absolute inset-x-5 rounded-md border border-[#30362c] bg-[#1e231c] p-3"
              style={{ top: `${16 + i * 18}%`, transform: `rotate(${(i - 1) * 2}deg)`, zIndex: i }}
            >
              <span className="font-display text-lg text-[#b8b27a]">{n}</span>
              <div className="mt-1 h-1.5 w-2/3 rounded-full bg-[#e8e6dc]/60" />
            </div>
          ))}
        </div>
      );
    case "colaborativo":
      return (
        <div className={`${frame} bg-[#f4efe6] p-4`} aria-hidden="true">
          <div className="grid h-full grid-cols-2 gap-2">
            {["#fbf8f2", "#efe6d6", "#f7f1e6", "#fbf8f2", "#ece2cf", "#f7f1e6"].map((bg, i) => (
              <div key={i} className="rounded-sm border border-[#ddd4c5] p-2" style={{ background: bg }}>
                <div className="h-1 w-5/6 rounded-full bg-[#1d1a16]/25" />
                <div className="mt-1 h-1 w-2/3 rounded-full bg-[#1d1a16]/25" />
                <div className="mt-2 h-1.5 w-1/3 rounded-full bg-[#8a6a3b]/70" />
              </div>
            ))}
          </div>
        </div>
      );
  }
}
