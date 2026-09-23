"use client";

import { useId, useRef, useState } from "react";
import { deleteItemAction, reorderAction, updateMediaAction } from "@/app/painel/memorias/[id]/actions";
import { track } from "@/lib/analytics-client";
import { fill, t } from "@/lib/i18n";
import type { EditorMedia } from "@/components/editor/types";
import { ownerEndpoints, uploadFile, UploadError } from "@/components/editor/upload-client";

type Job = { key: string; name: string; state: "uploading" | "failed"; reason?: string };

type Props = {
  memoryId: string;
  sectionId: string | null;
  items: EditorMedia[];
  onChange: (updater: (all: EditorMedia[]) => EditorMedia[]) => void;
  compact?: boolean;
};

const reasons = t.editor.upload.reasons;

export function MediaManager({ memoryId, sectionId, items, onChange, compact = false }: Props) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);

  const sorted = [...items].sort((a, b) => a.position - b.position);

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setJobs((current) => [...current, { key, name: file.name, state: "uploading" }]);
      try {
        const media = await uploadFile(file, ownerEndpoints(memoryId, sectionId));
        onChange((all) => [
          ...all,
          {
            id: media.id,
            kind: media.kind,
            status: "ready",
            section_id: sectionId,
            contribution_id: null,
            alt: "",
            position: 999,
            width: media.width,
            height: media.height,
            thumbUrl: media.thumbUrl,
          },
        ]);
        if (media.kind === "image") track("photo_uploaded");
        setJobs((current) => current.filter((job) => job.key !== key));
      } catch (error) {
        const code = error instanceof UploadError ? error.code : "generic";
        setJobs((current) =>
          current.map((job) =>
            job.key === key ? { ...job, state: "failed", reason: reasons[code as keyof typeof reasons] ?? reasons.generic } : job,
          ),
        );
      }
    }
  };

  const move = async (id: string, delta: number) => {
    const index = sorted.findIndex((item) => item.id === id);
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    const positions = new Map(next.map((item, position) => [item.id, position]));
    onChange((all) => all.map((item) => (positions.has(item.id) ? { ...item, position: positions.get(item.id)! } : item)));
    await reorderAction("memory_media", memoryId, next.map((item) => item.id));
  };

  const remove = async (id: string) => {
    onChange((all) => all.filter((item) => item.id !== id));
    await deleteItemAction("memory_media", id);
  };

  return (
    <div className="grid gap-4">
      {sorted.length > 0 ? (
        <ul className={`grid gap-3 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
          {sorted.map((item, index) => (
            <li key={item.id} className="group grid gap-2">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-paper-2">
                {item.thumbUrl ? <img src={item.thumbUrl} alt={item.alt} className="h-full w-full object-cover" /> : null}
                {item.kind === "video" ? (
                  <span className="absolute bottom-2 left-2 rounded-full bg-night/80 px-2 py-0.5 text-[0.65rem] text-paper">
                    {t.editor.upload.videoBadge}
                  </span>
                ) : null}
                <div className="absolute inset-x-1.5 top-1.5 flex justify-between gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <span className="flex gap-1">
                    <IconButton label={t.editor.steps.moments.moveUp} onClick={() => move(item.id, -1)} disabled={index === 0}>
                      ←
                    </IconButton>
                    <IconButton
                      label={t.editor.steps.moments.moveDown}
                      onClick={() => move(item.id, 1)}
                      disabled={index === sorted.length - 1}
                    >
                      →
                    </IconButton>
                  </span>
                  <IconButton label={t.editor.upload.remove} onClick={() => remove(item.id)}>
                    ×
                  </IconButton>
                </div>
              </div>
              {!compact && item.kind === "image" ? (
                <input
                  aria-label={t.editor.upload.alt}
                  placeholder={t.editor.upload.alt}
                  defaultValue={item.alt}
                  maxLength={200}
                  onBlur={(event) => {
                    const alt = event.target.value;
                    if (alt === item.alt) return;
                    onChange((all) => all.map((m) => (m.id === item.id ? { ...m, alt } : m)));
                    void updateMediaAction(item.id, { alt });
                  }}
                  className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs text-ink-2 placeholder:text-muted hover:border-line focus:border-ink/40 focus:outline-none"
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {jobs.length > 0 ? (
        <ul className="grid gap-2" aria-live="polite">
          {jobs.map((job) => (
            <li
              key={job.key}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                job.state === "failed" ? "bg-danger/8 text-danger" : "bg-paper-2 text-ink-2"
              }`}
            >
              <span className="truncate">
                {job.state === "failed"
                  ? `${fill(t.editor.upload.failed, { name: job.name })}: ${job.reason}`
                  : fill(t.editor.upload.uploading, { name: job.name })}
              </span>
              {job.state === "failed" ? (
                <button
                  type="button"
                  className="shrink-0 text-xs underline"
                  onClick={() => setJobs((current) => current.filter((j) => j.key !== job.key))}
                >
                  {t.editor.upload.dismiss}
                </button>
              ) : (
                <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={`grid cursor-pointer justify-items-center gap-1 rounded-2xl border border-dashed px-6 text-center transition-colors ${
          compact ? "py-5" : "py-10"
        } ${dragging ? "border-brass bg-brass/5" : "border-line hover:border-ink/30 hover:bg-card"}`}
      >
        <span className="text-sm text-ink-2">{t.editor.upload.drop}</span>
        <span className="text-xs text-muted">
          {t.editor.upload.or} <span className="font-medium text-ink underline underline-offset-4">{t.editor.upload.choose}</span>
        </span>
        <input
          ref={input}
          id={inputId}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-7 w-7 place-items-center rounded-full bg-card/95 text-sm text-ink shadow-sm hover:bg-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
