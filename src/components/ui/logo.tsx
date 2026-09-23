import Link from "next/link";
import { t } from "@/lib/i18n";

export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <path d="M16 3.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="16" cy="18.5" rx="9.5" ry="11" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="16" cy="18.5" rx="5.5" ry="6.8" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <circle cx="16" cy="6.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2.5 ${light ? "text-paper" : "text-ink"}`}
      aria-label={t.site.brand}
    >
      <LogoMark className="h-7 w-7 transition-transform duration-500 ease-[var(--ease-soft)] group-hover:-rotate-6" />
      <span className="font-display text-[1.55rem] leading-none">{t.site.brand}</span>
    </Link>
  );
}
