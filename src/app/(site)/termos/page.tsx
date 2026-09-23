import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/legal-document";
import { terms } from "@/lib/i18n/pt-BR/legal";
import { env } from "@/server/env";

export const metadata: Metadata = { title: terms.title };

export default function Page() {
  return <LegalDocument document={terms} contactEmail={env().CONTACT_EMAIL ?? null} />;
}
