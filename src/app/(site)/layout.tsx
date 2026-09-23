import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { currentUser } from "@/server/auth/session";
import { env } from "@/server/env";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      {children}
      <SiteFooter contactEmail={env().CONTACT_EMAIL ?? null} />
    </>
  );
}
