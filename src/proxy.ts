import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/server/security/csp";
import { env } from "@/server/env";

const PRIVATE_CONTENT = /^\/(m|contribuir)\//;
const PREVIEW_FRAME = /^\/painel\/memorias\/[^/]+\/visualizar\/quadro$/;
const NEEDS_SESSION = /^\/(painel|entrar|criar-conta|redefinir-senha)(\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const config = env();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    supabaseOrigin: new URL(config.SUPABASE_URL).origin,
    allowSameOriginFrame: PREVIEW_FRAME.test(pathname),
    dev: config.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  if (NEEDS_SESSION.test(pathname)) {
    // Refreshes an expiring session and writes the rotated cookies back.
    const supabase = createServerClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      cookieOptions: { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "lax", path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getUser();

    if (pathname.startsWith("/painel") && !data.user) {
      const login = request.nextUrl.clone();
      login.pathname = "/entrar";
      login.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(login);
    }
  }

  response.headers.set("Content-Security-Policy", csp);

  response.headers.set("X-Frame-Options", PREVIEW_FRAME.test(pathname) ? "SAMEORIGIN" : "DENY");

  if (PRIVATE_CONTENT.test(pathname) || pathname.startsWith("/painel")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  if (PRIVATE_CONTENT.test(pathname)) {
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
