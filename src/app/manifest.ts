import type { MetadataRoute } from "next";
import { t } from "@/lib/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t.site.brand,
    short_name: t.site.brand,
    description: t.site.description,
    start_url: "/painel",
    display: "standalone",
    background_color: "#f2eee7",
    theme_color: "#f2eee7",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
