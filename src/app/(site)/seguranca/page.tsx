import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/legal-document";
import { securityPage } from "@/lib/i18n/pt-BR/legal";
import { env } from "@/server/env";

export const metadata: Metadata = { title: securityPage.title };

export default function Page() {
  return <LegalDocument document={securityPage} contactEmail={env().CONTACT_EMAIL ?? null} />;
}
