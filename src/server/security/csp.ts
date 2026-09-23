type CspOptions = {
  nonce: string;
  supabaseOrigin: string | null;
  allowSameOriginFrame: boolean;
  dev: boolean;
};

// Scripts are nonce-bound. Style elements are nonce-bound too; only style
// attributes are allowed inline because React and the animation library set
// them during server rendering.
export function buildCsp({ nonce, supabaseOrigin, allowSameOriginFrame, dev }: CspOptions): string {
  const storage = supabaseOrigin ? ` ${supabaseOrigin}` : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data:${storage}`,
    `media-src 'self' blob:${storage}`,
    "font-src 'self'",
    `connect-src 'self'${storage}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    `frame-ancestors ${allowSameOriginFrame ? "'self'" : "'none'"}`,
    "manifest-src 'self'",
  ];
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
