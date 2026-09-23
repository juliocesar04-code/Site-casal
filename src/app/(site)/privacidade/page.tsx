import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/legal-document";
import { privacy } from "@/lib/i18n/pt-BR/legal";
import { env } from "@/server/env";

export const metadata: Metadata = { title: privacy.title };

export default function Page() {
  return <LegalDocument document={privacy} contactEmail={env().CONTACT_EMAIL ?? null} />;
}
