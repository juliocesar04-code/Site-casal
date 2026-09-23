import type { MetadataRoute } from "next";
import { env } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  const base = env().APP_URL;
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacidade", "/termos", "/seguranca"], disallow: ["/m/", "/contribuir/", "/painel", "/api/", "/auth/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
