import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: t.dashboard.title,
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/painel");
  return children;
}
