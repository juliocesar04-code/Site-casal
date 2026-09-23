import { z } from "zod";

// Control characters (except newline and tab) and bidirectional overrides are
// removed: the latter can make a name render differently from what is stored.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\u202a-\u202e\u2066-\u2069\ufeff]/g;

export function cleanText(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").replace(CONTROL, "").replace(/\n{4,}/g, "\n\n\n").trim();
}

export function cleanLine(value: string): string {
  return cleanText(value).replace(/\s+/g, " ");
}

export const line = (max: number) => z.string().max(max * 2).transform(cleanLine).pipe(z.string().max(max));

export const requiredLine = (max: number) =>
  z.string().max(max * 2).transform(cleanLine).pipe(z.string().min(1).max(max));

export const paragraph = (max: number) => z.string().max(max * 2).transform(cleanText).pipe(z.string().max(max));

export const requiredParagraph = (max: number) =>
  z.string().max(max * 2).transform(cleanText).pipe(z.string().min(1).max(max));
