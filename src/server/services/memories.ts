import "server-only";
import { isTemplateId, type TemplateId } from "@/domain/presets";
import { createUserClient } from "@/server/db/clients";
import {
  MEDIA_COLUMNS,
  MEMORY_COLUMNS,
  type ContributionRow,
  type LinkRow,
  type MediaRow,
  type MemoryRow,
  type ResponseRow,
  type SectionRow,
  type TimelineRow,
} from "@/server/db/types";
import type { SessionUser } from "@/server/auth/session";
import { enforceLimit } from "@/server/security/rate-limit";
import { logEvent } from "@/server/security/log";
import { fromDatabaseError, ServiceError } from "@/server/services/errors";
import { processStorageDeletions } from "@/server/services/maintenance";
import type { MemoryPatch } from "@/lib/validation/schemas";

// Every read and write here goes through the user's own client, so RLS
// scopes it to rows they own. Ownership is never taken from arguments.

export type MemoryBundle = {
  memory: MemoryRow;
  sections: SectionRow[];
  timeline: TimelineRow[];
  media: MediaRow[];
  contributions: ContributionRow[];
  links: LinkRow[];
  responses: ResponseRow[];
};

export async function getMemoryBundle(memoryId: string): Promise<MemoryBundle | null> {
  const db = await createUserClient();
  const { data: memory } = await db.from("memories").select(MEMORY_COLUMNS).eq("id", memoryId).maybeSingle();
  if (!memory) return null;

  const [sections, timeline, media, contributions, links, responses] = await Promise.all([
    db.from("memory_sections").select("id, memory_id, title, body, event_date, transition, position")
      .eq("memory_id", memoryId).order("position").order("id"),
    db.from("memory_timeline").select("id, memory_id, event_date, title, body, media_id, position")
      .eq("memory_id", memoryId).order("position").order("id"),
    db.from("memory_media").select(MEDIA_COLUMNS).eq("memory_id", memoryId).order("position").order("id"),
    db.from("memory_contributions").select("id, memory_id, link_id, author_name, body, status, created_at")
      .eq("memory_id", memoryId).order("created_at"),
    db.from("collaboration_links").select("id, memory_id, label, expires_at, revoked_at, created_at")
      .eq("memory_id", memoryId).order("created_at", { ascending: false }),
    db.from("recipient_responses").select("id, memory_id, author_name, body, read_at, created_at")
      .eq("memory_id", memoryId).order("created_at", { ascending: false }),
  ]);

  return {
    memory: memory as MemoryRow,
    sections: (sections.data ?? []) as SectionRow[],
    timeline: (timeline.data ?? []) as TimelineRow[],
    media: (media.data ?? []) as MediaRow[],
    contributions: (contributions.data ?? []) as ContributionRow[],
    links: (links.data ?? []) as LinkRow[],
    responses: (responses.data ?? []) as ResponseRow[],
  };
}

export type DashboardItem = Pick<
  MemoryRow,
  "id" | "public_slug" | "status" | "template_id" | "title" | "recipient_name" | "release_at" | "published_at" | "updated_at" | "created_at"
> & { thumb_path: string | null; is_collaborative: boolean; pending_contributions: number; unread_responses: number };

export async function listDashboard(): Promise<DashboardItem[]> {
  const db = await createUserClient();
  const { data, error } = await db
    .from("memories")
    .select(
      `id, public_slug, status, template_id, title, recipient_name, release_at, published_at, updated_at, created_at,
       memory_media(thumb_path, poster_path, status, position),
       collaboration_links(id),
       memory_contributions(status),
       recipient_responses(read_at)`,
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  type Row = DashboardItem & {
    memory_media: { thumb_path: string | null; poster_path: string | null; status: string; position: number }[];
    collaboration_links: { id: string }[];
    memory_contributions: { status: string }[];
    recipient_responses: { read_at: string | null }[];
  };

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const cover = row.memory_media
      .filter((media) => media.status === "ready")
      .sort((a, b) => a.position - b.position)[0];
    return {
      id: row.id,
      public_slug: row.public_slug,
      status: row.status,
      template_id: row.template_id,
      title: row.title,
      recipient_name: row.recipient_name,
      release_at: row.release_at,
      published_at: row.published_at,
      updated_at: row.updated_at,
      created_at: row.created_at,
      thumb_path: cover?.thumb_path ?? cover?.poster_path ?? null,
      is_collaborative: row.template_id === "colaborativo" || row.collaboration_links.length > 0,
      pending_contributions: row.memory_contributions.filter((c) => c.status === "pending").length,
      unread_responses: row.recipient_responses.filter((r) => r.read_at === null).length,
    };
  });
}

export async function createDraft(user: SessionUser, template: unknown): Promise<string> {
  await enforceLimit("draftWrite", user.id);
  const templateId: TemplateId = isTemplateId(template) ? template : "classico";
  const db = await createUserClient();
  const { data, error } = await db
    .from("memories")
    .insert({ owner_id: user.id, template_id: templateId })
    .select("id")
    .single();

  const known = fromDatabaseError(error);
  if (known) throw known;
  if (error || !data) throw new Error("draft creation failed");

  await logEvent("draft_created", { actorId: user.id, memoryId: data.id });
  return data.id as string;
}

async function expectRows(result: { data: unknown[] | null; error: { code?: string; message?: string } | null }) {
  const known = fromDatabaseError(result.error);
  if (known) throw known;
  if (result.error) throw new Error(result.error.message);
  // RLS hides rows the user may not edit; an empty result means not editable.
  if (!result.data || result.data.length === 0) throw new ServiceError("not_editable");
}

export async function saveMemoryFields(user: SessionUser, memoryId: string, patch: MemoryPatch): Promise<string> {
  await enforceLimit("draftWrite", user.id);
  const db = await createUserClient();
  const result = await db
    .from("memories")
    .update(patch)
    .eq("id", memoryId)
    .eq("status", "draft")
    .select("updated_at");
  await expectRows(result);
  return (result.data?.[0] as { updated_at: string }).updated_at;
}

type ChildTable = "memory_sections" | "memory_timeline";

export async function addChild(user: SessionUser, table: ChildTable, memoryId: string): Promise<string> {
  await enforceLimit("draftWrite", user.id);
  const db = await createUserClient();
  const { count } = await db.from(table).select("id", { count: "exact", head: true }).eq("memory_id", memoryId);
  const result = await db
    .from(table)
    .insert({ memory_id: memoryId, position: count ?? 0 })
    .select("id");
  await expectRows(result);
  return (result.data?.[0] as { id: string }).id;
}

export async function updateChild(
  user: SessionUser,
  table: ChildTable | "memory_media",
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await enforceLimit("draftWrite", user.id);
  const db = await createUserClient();
  await expectRows(await db.from(table).update(patch).eq("id", id).select("id"));
}

export async function deleteChild(user: SessionUser, table: ChildTable | "memory_media", id: string): Promise<void> {
  await enforceLimit("draftWrite", user.id);
  const db = await createUserClient();
  await expectRows(await db.from(table).delete().eq("id", id).select("id"));
  if (table === "memory_media") await processStorageDeletions(25);
}

export async function reorderChildren(
  user: SessionUser,
  table: ChildTable | "memory_media",
  memoryId: string,
  orderedIds: string[],
): Promise<void> {
  await enforceLimit("draftWrite", user.id);
  const db = await createUserClient();
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      db.from(table).update({ position }).eq("id", id).eq("memory_id", memoryId).select("id"),
    ),
  );
  for (const result of results) await expectRows(result);
}

export async function setContributionStatus(
  user: SessionUser,
  contributionId: string,
  status: "approved" | "rejected" | "pending",
): Promise<void> {
  await enforceLimit("draftWrite", user.id);
  const db = await createUserClient();
  await expectRows(await db.from("memory_contributions").update({ status }).eq("id", contributionId).select("id"));
}

export async function markResponsesRead(memoryId: string): Promise<void> {
  const db = await createUserClient();
  await db
    .from("recipient_responses")
    .update({ read_at: new Date().toISOString() })
    .eq("memory_id", memoryId)
    .is("read_at", null);
}

export async function returnToDraft(user: SessionUser, memoryId: string): Promise<void> {
  const db = await createUserClient();
  const { error } = await db.rpc("return_to_draft", { p_memory_id: memoryId });
  const known = fromDatabaseError(error);
  if (known) throw known;
  if (error) throw new Error(error.message);
  await logEvent("memory_returned_to_draft", { actorId: user.id, memoryId });
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const db = await createUserClient();
  const { error } = await db.rpc("delete_memory", { p_memory_id: memoryId });
  const known = fromDatabaseError(error);
  if (known) throw known;
  if (error) throw new Error(error.message);
  await processStorageDeletions(200);
}
