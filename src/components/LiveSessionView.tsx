"use client";

import { Badge } from "@/components/ui";
import { ExportMenu } from "@/components/ExportMenu";
import { modelLabel } from "@/lib/models";
import type { LiveLine, SessionRecord } from "@/lib/types";
import { fmtDate, fmtTime } from "@/lib/utils";

function Panel({ title, lines }: { title: string; lines: LiveLine[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-line bg-card shadow-card">
      <div className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {title}
      </div>
      <div className="space-y-2.5 px-4 py-3">
        {lines.length === 0 && (
          <p className="text-sm text-ink-soft">No lines captured.</p>
        )}
        {lines.map((l, i) => (
          <p key={i} className="text-[15px] leading-relaxed">
            <span className="mr-2 font-mono text-[11px] text-ink-soft">
              {fmtTime(l.at / 1000)}
            </span>
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Read-only view of a saved live session. */
export function LiveSessionView({ session }: { session: SessionRecord }) {
  const targets = Object.entries(session.liveTargets ?? {});
  const modeLabel =
    session.mode === "tandem"
      ? "Tandem"
      : session.mode === "translate"
        ? "Translation"
        : "Transcription";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {session.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge>{fmtDate(session.createdAt)}</Badge>
            <Badge tone="accent">{modelLabel(session.model)}</Badge>
            <Badge tone="gold">{modeLabel} session</Badge>
            {session.durationSec !== undefined && (
              <Badge>{fmtTime(session.durationSec)}</Badge>
            )}
          </div>
        </div>
        <ExportMenu session={session} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {session.liveSource && session.liveSource.length > 0 && (
          <Panel
            title={
              session.sourceLanguages.length > 0
                ? `Source · ${session.sourceLanguages.join(", ")}`
                : "Source"
            }
            lines={session.liveSource}
          />
        )}
        {targets.map(([lang, lines]) => (
          <Panel key={lang} title={lang} lines={lines} />
        ))}
      </div>
    </div>
  );
}
