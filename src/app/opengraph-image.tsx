import { ImageResponse } from "next/og";
import { t } from "@/lib/i18n";

export const alt = t.site.hero.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0f0e0d",
          color: "#f2eee7",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 2, color: "#c9a86a" }}>{t.site.brand}</div>
        <div style={{ fontSize: 76, lineHeight: 1.05, maxWidth: 900 }}>{t.site.hero.title}</div>
        <div style={{ fontSize: 28, color: "#a39b90" }}>{t.site.tagline}</div>
      </div>
    ),
    size,
  );
}
