const FALLBACK = "/painel";

// Only same-site absolute paths are accepted. Anything that a browser could
// resolve to another origin ("//evil.com", "/\\evil.com", "https://…",
// encoded variants) falls back to the dashboard.
export function safeRedirectPath(value: unknown, fallback = FALLBACK): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;

  let decoded = value;
  try {
    for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(decoded); i++) decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return fallback;

  try {
    const url = new URL(value, "https://relicario.invalid");
    if (url.origin !== "https://relicario.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
