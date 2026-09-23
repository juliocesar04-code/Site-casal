import { describe, expect, it } from "vitest";
import { snapshotSchema, toViewMemory } from "@/domain/snapshot";
import { snapshotFromBundle } from "@/server/services/draft-view";
import type { MemoryBundle } from "@/server/services/memories";

const memoryId = "c0000000-0000-4000-8000-000000000001";
const media = (id: string, extra: Partial<MemoryBundle["media"][number]> = {}): MemoryBundle["media"][number] => ({
  id,
  memory_id: memoryId,
  section_id: null,
  contribution_id: null,
  kind: "image",
  status: "ready",
  storage_path: `${memoryId}/${id}/image.webp`,
  poster_path: null,
  thumb_path: `${memoryId}/${id}/thumb.webp`,
  width: 100,
  height: 80,
  duration_ms: null,
  checksum: "0".repeat(64),
  alt: "",
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

const bundle: MemoryBundle = {
  memory: {
    id: memoryId,
    public_slug: "AbCdEfGhIjKlMn",
    status: "draft",
    template_id: "classico",
    theme: "marfim",
    occasion: null,
    title: "Título",
    recipient_name: "Lia",
    sender_name: "Rui",
    opening_line: null,
    message: "Oi",
    closing_line: null,
    release_at: null,
    paid_payment_id: null,
    content_hash: null,
    published_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  sections: [
    { id: "c0000000-0000-4000-8000-00000000000b", memory_id: memoryId, title: "B", body: "", event_date: null, transition: "fade", position: 1 },
    { id: "c0000000-0000-4000-8000-00000000000a", memory_id: memoryId, title: "A", body: "", event_date: null, transition: "zoom", position: 0 },
  ],
  timeline: [],
  media: [
    media("c0000000-0000-4000-8000-000000000011", { position: 2 }),
    media("c0000000-0000-4000-8000-000000000012", { position: 1 }),
    media("c0000000-0000-4000-8000-000000000013", { status: "pending" }),
    media("c0000000-0000-4000-8000-000000000014", { section_id: "c0000000-0000-4000-8000-00000000000a" }),
  ],
  contributions: [
    { id: "c0000000-0000-4000-8000-000000000021", memory_id: memoryId, link_id: null, author_name: "Ana", body: "Oi", status: "approved", created_at: "2026-01-01T00:00:00Z" },
    { id: "c0000000-0000-4000-8000-000000000022", memory_id: memoryId, link_id: null, author_name: "Zé", body: "?", status: "pending", created_at: "2026-01-01T00:00:00Z" },
  ],
  links: [],
  responses: [],
};

describe("preview snapshot", () => {
  const snapshot = snapshotFromBundle(bundle);

  it("has the same shape the database produces", () => {
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("orders by position and excludes unfinished uploads and unapproved contributions", () => {
    expect(snapshot.sections.map((s) => s.title)).toEqual(["A", "B"]);
    expect(snapshot.gallery.map((m) => m.id)).toEqual([
      "c0000000-0000-4000-8000-000000000012",
      "c0000000-0000-4000-8000-000000000011",
    ]);
    expect(snapshot.sections[0]!.media).toHaveLength(1);
    expect(snapshot.contributions.map((c) => c.author)).toEqual(["Ana"]);
  });

  it("never exposes storage paths to the browser", () => {
    const urls = new Map(
      bundle.media.map((m) => [m.storage_path, `https://signed.example/${m.id}?token=t`] as const),
    );
    const view = toViewMemory(snapshot, urls);
    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain("image.webp");
    expect(serialised).not.toContain("AbCdEfGhIjKlMn");
    expect(view.gallery[0]!.src).toContain("signed.example");
  });

  it("drops media whose URL could not be signed", () => {
    expect(toViewMemory(snapshot, new Map()).gallery).toEqual([]);
  });
});
