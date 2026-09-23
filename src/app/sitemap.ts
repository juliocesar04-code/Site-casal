import type { MetadataRoute } from "next";
import { env } from "@/server/env";

// Only public marketing pages. Memories are private and never listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env().APP_URL;
  return ["", "/privacidade", "/termos", "/seguranca", "/criar-conta"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.4,
  }));
}
