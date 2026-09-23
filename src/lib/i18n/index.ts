import { app } from "@/lib/i18n/pt-BR/app";
import { contribute, experience } from "@/lib/i18n/pt-BR/experience";
import { site } from "@/lib/i18n/pt-BR/site";

// Single locale today. New locales add a sibling folder with the same shape
// and a lookup here; components keep importing `t`.
export const locale = "pt-BR";
export const timeZone = "America/Sao_Paulo";

export const t = { site, ...app, experience, contribute } as const;

export type Dictionary = typeof t;

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

// Templates with a count use "singular|plural". Portuguese uses the singular
// only for exactly one ("0 capítulos", "1 capítulo").
export function plural(template: string, count: number): string {
  const [one = template, other = one] = template.split("|");
  return fill(count === 1 ? one : other, { count });
}

export function formatDate(value: string | Date, style: "long" | "short" | "datetime" = "long"): string {
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00` : value) : value;
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "2-digit", month: "short", year: "numeric" }
      : style === "datetime"
        ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
        : { day: "numeric", month: "long", year: "numeric" };
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

export function formatRelative(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  return formatDate(value, "short");
}
