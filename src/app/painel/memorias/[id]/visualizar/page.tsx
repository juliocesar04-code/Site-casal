import { PreviewContent } from "./preview";

export default async function PreviewPage({ params }: PageProps<"/painel/memorias/[id]/visualizar">) {
  const { id } = await params;
  return <PreviewContent id={id} />;
}
