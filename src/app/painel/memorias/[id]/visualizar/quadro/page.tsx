import { PreviewContent } from "../preview";

// Same content as the full preview, served with frame-ancestors 'self' so the
// editor can embed it at phone and desktop widths.
export default async function PreviewFramePage({ params }: PageProps<"/painel/memorias/[id]/visualizar/quadro">) {
  const { id } = await params;
  return <PreviewContent id={id} />;
}
