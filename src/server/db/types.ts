import type { MemoryStatus } from "@/domain/memory-status";
import type { Occasion, TemplateId, ThemeId, Transition } from "@/domain/presets";

export type MemoryRow = {
  id: string;
  public_slug: string;
  status: MemoryStatus;
  template_id: TemplateId;
  theme: ThemeId;
  occasion: Occasion | null;
  title: string | null;
  recipient_name: string | null;
  sender_name: string | null;
  opening_line: string | null;
  message: string | null;
  closing_line: string | null;
  release_at: string | null;
  paid_payment_id: string | null;
  content_hash: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SectionRow = {
  id: string;
  memory_id: string;
  title: string;
  body: string;
  event_date: string | null;
  transition: Transition;
  position: number;
};

export type TimelineRow = {
  id: string;
  memory_id: string;
  event_date: string | null;
  title: string;
  body: string;
  media_id: string | null;
  position: number;
};

export type MediaRow = {
  id: string;
  memory_id: string;
  section_id: string | null;
  contribution_id: string | null;
  kind: "image" | "video";
  status: "pending" | "ready" | "rejected";
  storage_path: string;
  poster_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  checksum: string | null;
  alt: string;
  position: number;
  created_at: string;
};

export type ContributionRow = {
  id: string;
  memory_id: string;
  link_id: string | null;
  author_name: string;
  body: string;
  status: "pending" | "approved" | "rejected" | "locked";
  created_at: string;
};

export type LinkRow = {
  id: string;
  memory_id: string;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type ResponseRow = {
  id: string;
  memory_id: string;
  author_name: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
};

export const MEMORY_COLUMNS =
  "id, public_slug, status, template_id, theme, occasion, title, recipient_name, sender_name, opening_line, message, closing_line, release_at, paid_payment_id, content_hash, published_at, created_at, updated_at";

export const MEDIA_COLUMNS =
  "id, memory_id, section_id, contribution_id, kind, status, storage_path, poster_path, thumb_path, width, height, duration_ms, checksum, alt, position, created_at";
