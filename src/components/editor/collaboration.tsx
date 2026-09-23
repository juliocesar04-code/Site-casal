"use client";

import { useState, useTransition } from "react";
import { contributionStatusAction, createLinkAction, revokeLinkAction } from "@/app/painel/memorias/[id]/actions";
import { Button } from "@/components/ui/button";
import { formatRelative, t } from "@/lib/i18n";
import type { ContributionRow, LinkRow } from "@/server/db/types";
import type { EditorMedia } from "@/components/editor/types";

const copy = t.editor.collaboration;
const EXPIRY = [0, 3, 7, 30] as const;

export function CollaborationPanel({
  memoryId,
  links,
  setLinks,
  contributions,
  setContributions,
  media,
}: {
  memoryId: string;
  links: LinkRow[];
  setLinks: (updater: (all: LinkRow[]) => LinkRow[]) => void;
  contributions: ContributionRow[];
  setContributions: (updater: (all: ContributionRow[]) => ContributionRow[]) => void;
  media: EditorMedia[];
}) {
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState<(typeof EXPIRY)[number]>(7);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const result = await createLinkAction(memoryId, { label, expiresInDays: expires });
      if (!result.ok) {
        setError(t.errors[result.error as keyof typeof t.errors] ?? t.errors.generic);
        return;
      }
      setError(null);
      setFresh(result.data);
      setLabel("");
      setLinks((all) => [
        {
          id: `new-${Date.now()}`,
          memory_id: memoryId,
          label: label || null,
          expires_at: expires ? new Date(Date.now() + expires * 86_400_000).toISOString() : null,
          revoked_at: null,
          created_at: new Date().toISOString(),
        },
        ...all,
      ]);
    });

  const setStatus = async (id: string, status: ContributionRow["status"]) => {
    setContributions((all) => all.map((c) => (c.id === id ? { ...c, status } : c)));
    await contributionStatusAction(id, status);
  };

  const linkState = (link: LinkRow) =>
    link.revoked_at ? copy.revoked : link.expires_at && new Date(link.expires_at) < new Date() ? copy.expired : copy.active;

  return (
    <div className="grid gap-8">
      <p className="leading-relaxed text-ink-2">{copy.lead}</p>

      <div className="grid gap-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-2 text-sm">
            <span className="font-medium text-ink-2">{copy.label}</span>
            <input
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={copy.labelHint}
              className="rounded-xl border border-line bg-paper px-4 py-3 focus:border-ink/50 focus:outline-none"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium text-ink-2">{copy.expires}</span>
            <select
              value={expires}
              onChange={(e) => setExpires(Number(e.target.value) as (typeof EXPIRY)[number])}
              className="rounded-xl border border-line bg-paper px-4 py-3"
            >
              {EXPIRY.map((days) => (
                <option key={days} value={days}>
                  {copy.expiresOptions[days]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button onClick={create} disabled={pending}>
          {copy.create}
        </Button>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {fresh ? (
          <div className="grid gap-3 rounded-xl bg-paper-2 p-4" role="status">
            <p className="text-sm text-ink-2">{copy.newLink}</p>
            <code className="block overflow-x-auto rounded-lg bg-card px-3 py-2 text-xs">{fresh}</code>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(fresh);
                setCopied(true);
              }}
            >
              {copied ? t.published.copied : copy.copy}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {links.length === 0 ? (
          <p className="text-sm text-muted">{copy.noLinks}</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="grid">
                  <span className="text-ink">{link.label || copy.title}</span>
                  <span className="text-xs text-muted">
                    {linkState(link)} · {formatRelative(link.created_at)}
                  </span>
                </span>
                {!link.revoked_at && !link.id.startsWith("new-") ? (
                  <button
                    type="button"
                    className="text-danger underline-offset-4 hover:underline"
                    onClick={async () => {
                      setLinks((all) => all.map((l) => (l.id === link.id ? { ...l, revoked_at: new Date().toISOString() } : l)));
                      await revokeLinkAction(memoryId, link.id);
                    }}
                  >
                    {copy.revoke}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4">
        <h3 className="font-display text-3xl">{copy.contributions}</h3>
        {contributions.length === 0 ? (
          <p className="text-sm text-muted">{copy.noContributions}</p>
        ) : (
          <ul className="grid gap-4">
            {contributions.map((item) => {
              const attached = media.filter((m) => m.contribution_id === item.id);
              return (
                <li key={item.id} className="grid gap-3 rounded-2xl border border-line bg-card p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-xl">{item.author_name}</p>
                    <span className="text-xs text-muted">{copy.statuses[item.status]}</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{item.body}</p>
                  {attached.length > 0 ? (
                    <div className="flex gap-2">
                      {attached.map((m) =>
                        m.thumbUrl ? (
                          <img key={m.id} src={m.thumbUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                        ) : null,
                      )}
                    </div>
                  ) : null}
                  <div className="flex gap-4 text-sm">
                    {item.status === "pending" ? (
                      <>
                        <button type="button" className="font-medium text-ok" onClick={() => setStatus(item.id, "approved")}>
                          {copy.approve}
                        </button>
                        <button type="button" className="text-muted" onClick={() => setStatus(item.id, "rejected")}>
                          {copy.reject}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="text-muted underline-offset-4 hover:underline" onClick={() => setStatus(item.id, "pending")}>
                        {copy.undo}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
