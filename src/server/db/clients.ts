import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/server/env";

// Client bound to the visitor's session. Every query runs under RLS as that user.
export async function createUserClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, NODE_ENV } = env();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

let admin: SupabaseClient | undefined;

// Bypasses RLS. Only for the operations listed in docs/ARCHITECTURE.md; callers
// must have authorised the request before reaching for it.
export function createAdminClient(): SupabaseClient {
  if (!admin) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();
    admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return admin;
}
