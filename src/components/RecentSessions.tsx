"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileAudio, MicVocal, Trash2 } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { deleteSession, listSessions } from "@/lib/store";
import type { SessionRecord } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

export function RecentSessions() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);

  useEffect(() => {
    void listSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  if (sessions === null) return null;
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        No sessions yet — transcribe a file or start a live session above.
        Everything you create is stored privately in this browser.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sessions.map((s) => {
        const langs =
          s.kind === "upload"
            ? (s.transcript?.languages ?? [])
            : [...s.sourceLanguages, ...(s.targetLanguages ?? [])];
        const count =
          s.kind === "upload"
            ? `${s.transcript?.segments.length ?? 0} segments`
            : `${(s.liveSource?.length ?? 0) +
                Object.values(s.liveTargets ?? {}).reduce(
                  (n, l) => n + l.length,
                  0,
                )} lines`;
        return (
          <Card key={s.id} className="group relative p-4 transition hover:shadow-pop">
            <Link href={`/session/${s.id}`} className="block">
              <div className="flex items-center gap-2 text-accent">
                {s.kind === "upload" ? (
                  <FileAudio className="h-4 w-4" />
                ) : (
                  <MicVocal className="h-4 w-4" />
                )}
                <span className="text-xs font-medium uppercase tracking-wider">
                  {s.kind === "upload" ? "File" : "Live"}
                </span>
              </div>
              <h3 className="mt-2 line-clamp-2 font-display text-lg font-bold leading-snug">
                {s.title}
              </h3>
              <p className="mt-1 text-xs text-ink-soft">
                {fmtDate(s.createdAt)} · {count}
              </p>
              {langs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {langs.slice(0, 4).map((l) => (
                    <Badge key={l}>{l}</Badge>
                  ))}
                </div>
              )}
            </Link>
            <button
              type="button"
              aria-label="Delete session"
              onClick={() => {
                void deleteSession(s.id).then(() =>
                  setSessions(sessions.filter((x) => x.id !== s.id)),
                );
              }}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-soft opacity-0 transition hover:bg-rec/10 hover:text-rec group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        );
      })}
    </div>
  );
}
