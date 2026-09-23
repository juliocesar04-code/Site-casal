import { z } from "zod";
import { OCCASIONS, TEMPLATE_IDS, THEME_IDS, TRANSITIONS } from "@/domain/presets";

// Shape produced by private.build_memory_snapshot. Parsed defensively on read:
// a snapshot that does not match is treated as corrupt, never rendered loosely.
const storedMedia = z.object({
  id: z.uuid(),
  kind: z.enum(["image", "video"]),
  path: z.string(),
  poster: z.string().nullable(),
  thumb: z.string().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  duration_ms: z.number().int().positive().nullable(),
  checksum: z.string().nullable(),
  alt: z.string(),
});

export const snapshotSchema = z.object({
  version: z.literal(1),
  slug: z.string(),
  template: z.enum(TEMPLATE_IDS),
  theme: z.enum(THEME_IDS),
  occasion: z.enum(OCCASIONS).nullable(),
  title: z.string().nullable(),
  recipient: z.string().nullable(),
  sender: z.string().nullable(),
  opening: z.string().nullable(),
  message: z.string().nullable(),
  closing: z.string().nullable(),
  release_at: z.string().nullable(),
  sections: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      body: z.string(),
      date: z.string().nullable(),
      transition: z.enum(TRANSITIONS),
      media: z.array(storedMedia),
    }),
  ),
  timeline: z.array(
    z.object({
      id: z.uuid(),
      date: z.string().nullable(),
      title: z.string(),
      body: z.string(),
      media: storedMedia.nullable(),
    }),
  ),
  gallery: z.array(storedMedia),
  contributions: z.array(
    z.object({
      id: z.uuid(),
      author: z.string(),
      body: z.string(),
      media: z.array(storedMedia),
    }),
  ),
});

export type StoredMedia = z.infer<typeof storedMedia>;
export type MemorySnapshot = z.infer<typeof snapshotSchema>;

// What reaches the browser: storage paths replaced by short-lived URLs.
export type ViewMedia = {
  id: string;
  kind: "image" | "video";
  src: string;
  poster: string | null;
  width: number | null;
  height: number | null;
  alt: string;
};

export type ViewMemory = Omit<MemorySnapshot, "sections" | "timeline" | "gallery" | "contributions" | "slug"> & {
  sections: (Omit<MemorySnapshot["sections"][number], "media"> & { media: ViewMedia[] })[];
  timeline: (Omit<MemorySnapshot["timeline"][number], "media"> & { media: ViewMedia | null })[];
  gallery: ViewMedia[];
  contributions: (Omit<MemorySnapshot["contributions"][number], "media"> & { media: ViewMedia[] })[];
};

export function collectMedia(snapshot: MemorySnapshot): StoredMedia[] {
  return [
    ...snapshot.gallery,
    ...snapshot.sections.flatMap((section) => section.media),
    ...snapshot.timeline.flatMap((event) => (event.media ? [event.media] : [])),
    ...snapshot.contributions.flatMap((contribution) => contribution.media),
  ];
}

export function toViewMemory(snapshot: MemorySnapshot, urls: Map<string, string>): ViewMemory {
  const view = (media: StoredMedia): ViewMedia | null => {
    const src = urls.get(media.path);
    if (!src) return null;
    return {
      id: media.id,
      kind: media.kind,
      src,
      poster: media.poster ? (urls.get(media.poster) ?? null) : null,
      width: media.width,
      height: media.height,
      alt: media.alt,
    };
  };
  const list = (items: StoredMedia[]) => items.map(view).filter((item): item is ViewMedia => item !== null);

  const { slug: _slug, ...rest } = snapshot;
  return {
    ...rest,
    sections: snapshot.sections.map((section) => ({ ...section, media: list(section.media) })),
    timeline: snapshot.timeline.map((event) => ({ ...event, media: event.media ? view(event.media) : null })),
    gallery: list(snapshot.gallery),
    contributions: snapshot.contributions.map((item) => ({ ...item, media: list(item.media) })),
  };
}
