import "server-only";
import type { MemorySnapshot, StoredMedia } from "@/domain/snapshot";
import { collectMedia, toViewMemory, type ViewMemory } from "@/domain/snapshot";
import type { MediaRow } from "@/server/db/types";
import type { MemoryBundle } from "@/server/services/memories";
import { signReadUrls } from "@/server/storage/media-storage";

function stored(media: MediaRow): StoredMedia {
  return {
    id: media.id,
    kind: media.kind,
    path: media.storage_path,
    poster: media.poster_path,
    thumb: media.thumb_path,
    width: media.width,
    height: media.height,
    duration_ms: media.duration_ms,
    checksum: media.checksum,
    alt: media.alt,
  };
}

// Same shape and ordering rules as private.build_memory_snapshot, so the
// preview matches what publishing will freeze.
export function snapshotFromBundle(bundle: MemoryBundle): MemorySnapshot {
  const { memory } = bundle;
  const ready = bundle.media.filter((media) => media.status === "ready");
  const byOrder = (a: { position: number; id: string }, b: { position: number; id: string }) =>
    a.position - b.position || a.id.localeCompare(b.id);
  const timelineMedia = new Set(bundle.timeline.map((event) => event.media_id).filter(Boolean));

  return {
    version: 1,
    slug: memory.public_slug,
    template: memory.template_id,
    theme: memory.theme,
    occasion: memory.occasion,
    title: memory.title,
    recipient: memory.recipient_name,
    sender: memory.sender_name,
    opening: memory.opening_line,
    message: memory.message,
    closing: memory.closing_line,
    release_at: memory.release_at,
    sections: [...bundle.sections].sort(byOrder).map((section) => ({
      id: section.id,
      title: section.title,
      body: section.body,
      date: section.event_date,
      transition: section.transition,
      media: ready.filter((m) => m.section_id === section.id && !m.contribution_id).sort(byOrder).map(stored),
    })),
    timeline: [...bundle.timeline].sort(byOrder).map((event) => {
      const media = ready.find((m) => m.id === event.media_id);
      return { id: event.id, date: event.event_date, title: event.title, body: event.body, media: media ? stored(media) : null };
    }),
    gallery: ready
      .filter((m) => !m.section_id && !m.contribution_id && !timelineMedia.has(m.id))
      .sort(byOrder)
      .map(stored),
    contributions: bundle.contributions
      .filter((c) => c.status === "approved")
      .map((c) => ({
        id: c.id,
        author: c.author_name,
        body: c.body,
        media: ready.filter((m) => m.contribution_id === c.id).sort(byOrder).map(stored),
      })),
  };
}

export async function draftView(bundle: MemoryBundle): Promise<ViewMemory> {
  const snapshot = snapshotFromBundle(bundle);
  const paths = collectMedia(snapshot).flatMap((media) => [media.path, ...(media.poster ? [media.poster] : [])]);
  return toViewMemory(snapshot, await signReadUrls(paths));
}

export async function thumbnailUrls(media: MediaRow[]): Promise<Record<string, string>> {
  const paths = media.flatMap((item) => (item.thumb_path ? [item.thumb_path] : []));
  const urls = await signReadUrls(paths);
  return Object.fromEntries(
    media.flatMap((item) => {
      const url = item.thumb_path ? urls.get(item.thumb_path) : undefined;
      return url ? [[item.id, url]] : [];
    }),
  );
}
