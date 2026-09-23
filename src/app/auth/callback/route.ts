import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/redirect";
import { createUserClient } from "@/server/db/clients";
import { env } from "@/server/env";

// OAuth (PKCE) return. The verifier lives in an HttpOnly cookie set when the
// flow started, so a code stolen from the URL is useless on another browser.
export async function GET(request: NextRequest) {
  const { APP_URL } = env();
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (code && code.length < 512) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${APP_URL}${next}`);
  }

  return NextResponse.redirect(`${APP_URL}/entrar?erro=link`);
}
