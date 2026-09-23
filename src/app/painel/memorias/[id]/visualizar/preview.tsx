import { notFound } from "next/navigation";
import { Experience } from "@/components/experience/experience";
import { ResponseForm } from "@/components/experience/response-form";
import { uuid } from "@/lib/validation/schemas";
import { draftView } from "@/server/services/draft-view";
import { getMemoryBundle } from "@/server/services/memories";

async function disabledResponse() {
  "use server";
  return { status: "idle" as const };
}

// Renders the owner's current content with the public experience component.
// Access goes through RLS: other users get a 404.
export async function PreviewContent({ id }: { id: string }) {
  if (!uuid.safeParse(id).success) notFound();
  const bundle = await getMemoryBundle(id);
  if (!bundle) notFound();

  const memory = await draftView(bundle);
  return (
    <Experience
      mode="preview"
      memory={memory}
      seal={{
        slug: bundle.memory.public_slug,
        publishedAt: bundle.memory.published_at,
        hash: bundle.memory.content_hash,
        intact: Boolean(bundle.memory.content_hash),
      }}
      after={<ResponseForm action={disabledResponse} disabled />}
    />
  );
}
