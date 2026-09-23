import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/redirect";
import { createUserClient } from "@/server/db/clients";
import { env } from "@/server/env";

const TYPES: EmailOtpType[] = ["signup", "recovery", "email", "email_change", "invite", "magiclink"];

// Email links (confirmation and password recovery) use token_hash, which works
// even when the link is opened on a different device than the one that asked.
export async function GET(request: NextRequest) {
  const { APP_URL } = env();
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(params.get("next"));
  const supabase = await createUserClient();

  if (tokenHash && tokenHash.length < 256 && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${APP_URL}${type === "recovery" ? "/redefinir-senha" : next}`);
  }

  const code = params.get("code");
  if (code && code.length < 512) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${APP_URL}${next}`);
  }

  return NextResponse.redirect(`${APP_URL}/entrar?erro=link`);
}
