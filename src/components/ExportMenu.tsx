"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui";
import type { SessionRecord } from "@/lib/types";
import {
  downloadBlob,
  safeFilename,
  sessionToSrt,
  sessionToText,
  sessionToVtt,
} from "@/lib/export/format";
import { sessionToDocx } from "@/lib/export/docx";
import { exportPdf } from "@/lib/export/pdf";

type ExportKind = "txt" | "srt" | "vtt" | "docx" | "pdf";

function MenuItem({
  label,
  note,
  disabled,
  onSelect,
}: {
  label: string;
  note?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent-soft/50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="font-medium">{label}</span>
      {note && <span className="text-xs text-ink-soft">{note}</span>}
    </button>
  );
}

export function ExportMenu({ session }: { session: SessionRecord }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const base = safeFilename(session.title);
  const hasTimestamps = sessionToSrt(session) !== null;

  const run = async (kind: ExportKind) => {
    setBusy(true);
    try {
      if (kind === "txt") {
        downloadBlob(
          new Blob([sessionToText(session)], {
            type: "text/plain;charset=utf-8",
          }),
          `${base}.txt`,
        );
      } else if (kind === "srt") {
        const srt = sessionToSrt(session);
        if (srt) {
          downloadBlob(
            new Blob([srt], { type: "text/plain;charset=utf-8" }),
            `${base}.srt`,
          );
        }
      } else if (kind === "vtt") {
        const vtt = sessionToVtt(session);
        if (vtt) {
          downloadBlob(
            new Blob([vtt], { type: "text/vtt;charset=utf-8" }),
            `${base}.vtt`,
          );
        }
      } else if (kind === "docx") {
        downloadBlob(await sessionToDocx(session), `${base}.docx`);
      } else {
        exportPdf(session);
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        size="sm"
        busy={busy}
        onClick={() => setOpen(!open)}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-line bg-card p-1.5 shadow-pop">
          <MenuItem label="PDF" note="via print dialog" onSelect={() => void run("pdf")} />
          <MenuItem label="Word (.docx)" onSelect={() => void run("docx")} />
          <MenuItem label="Plain text (.txt)" onSelect={() => void run("txt")} />
          <MenuItem
            label="Subtitles (.srt)"
            disabled={!hasTimestamps}
            note={!hasTimestamps ? "needs timestamps" : undefined}
            onSelect={() => void run("srt")}
          />
          <MenuItem
            label="WebVTT (.vtt)"
            disabled={!hasTimestamps}
            onSelect={() => void run("vtt")}
          />
        </div>
      )}
    </div>
  );
}
