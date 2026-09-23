import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, Newsreader } from "next/font/google";
import { connection } from "next/server";
import { MotionProvider } from "@/components/motion-provider";
import { env } from "@/server/env";
import { locale, t } from "@/lib/i18n";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const text = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(env().APP_URL),
    title: { default: `${t.site.brand} · ${t.site.tagline}`, template: `%s · ${t.site.brand}` },
    description: t.site.description,
    applicationName: t.site.brand,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: t.site.brand,
      title: t.site.hero.title,
      description: t.site.description,
    },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#f2eee7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every HTML response carries a per-request CSP nonce, which only exists
  // for dynamically rendered pages.
  await connection();
  return (
    <html lang={locale} className={`${display.variable} ${sans.variable} ${text.variable}`}>
      <body className="min-h-dvh">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
