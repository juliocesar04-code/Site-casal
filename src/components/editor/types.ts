import type { ContributionRow, LinkRow, MediaRow, MemoryRow, SectionRow, TimelineRow } from "@/server/db/types";

export type EditorMedia = Pick<
  MediaRow,
  "id" | "kind" | "status" | "section_id" | "contribution_id" | "alt" | "position" | "width" | "height"
> & { thumbUrl: string | null };

export type EditorData = {
  memory: MemoryRow;
  sections: SectionRow[];
  timeline: TimelineRow[];
  media: EditorMedia[];
  contributions: ContributionRow[];
  links: LinkRow[];
};

export type EditableFields = Pick<
  MemoryRow,
  | "template_id"
  | "theme"
  | "occasion"
  | "title"
  | "recipient_name"
  | "sender_name"
  | "opening_line"
  | "message"
  | "closing_line"
  | "release_at"
>;
