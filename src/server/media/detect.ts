export type AllowedMime = "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/quicktime";

const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "MSNV", "dash"]);
const QUICKTIME_BRANDS = new Set(["qt  "]);

// Identifies a file from its first bytes. Extension, browser MIME and the
// Content-Type header are ignored everywhere; this is the only source of truth.
export function detectMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((value, index) => bytes[index] === value)) return "image/png";

  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));

  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";

  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (QUICKTIME_BRANDS.has(brand)) return "video/quicktime";
    if (MP4_BRANDS.has(brand)) return "video/mp4";
  }

  return null;
}

export function isImageMime(mime: AllowedMime): boolean {
  return mime.startsWith("image/");
}
