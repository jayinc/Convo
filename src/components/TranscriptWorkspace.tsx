"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { Badge, Button, Card, ErrorNote, Select } from "@/components/ui";
import { ExportMenu } from "@/components/ExportMenu";
import { LANGUAGES } from "@/lib/languages";
import { modelLabel } from "@/lib/models";
import type { SessionRecord, TranslateResponse } from "@/lib/types";
import { cn, fmtDate, fmtTime, speakerColor } from "@/lib/utils";
import { speakerName } from "@/lib/export/format";

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Renders an upload-kind session: diarized transcript, one-click translation
 * with side-by-side display, and exports.
 */
export function TranscriptWorkspace({
  session,
  onChange,
}: {
  session: SessionRecord;
  onChange: (s: SessionRecord) => void;
}) {
  const t = session.transcript;
  const translationLangs = Object.keys(session.translations ?? {});
  const [activeLang, setActiveLang] = useState<string | null>(
    translationLangs[0] ?? null,
  );
  const [pickerLang, setPickerLang] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!t) return null;

  const speakerIndex = (id: string) =>
    Math.max(0, t.speakers.findIndex((s) => s.id === id));

  const translate = async (target: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: t.segments.map((s) => s.text),
          targetLanguage: target,
          model: session.model,
        }),
      });
      const data = (await res.json()) as TranslateResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Translation failed");
      onChange({
        ...session,
        translations: { ...session.translations, [target]: data.translations },
      });
      setActiveLang(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const active = activeLang ? session.translations?.[activeLang] : undefined;

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
            {t.languages.map((l) => (
              <Badge key={l} tone="gold">
                {l}
              </Badge>
            ))}
            {session.mediaName && <Badge>{session.mediaName}</Badge>}
          </div>
        </div>
        <ExportMenu session={session} />
      </div>

      {/* Translation toolbar */}
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Languages className="h-4 w-4 text-accent" />
          Translation
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveLang(null)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              activeLang === null
                ? "bg-ink text-paper"
                : "bg-paper-2 text-ink-soft hover:text-ink",
            )}
          >
            Original
          </button>
          {translationLangs.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setActiveLang(l)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                activeLang === l
                  ? "bg-accent text-white"
                  : "bg-accent-soft text-accent-deep hover:bg-accent/15",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select
            className="h-8 w-44 text-xs"
            value={pickerLang}
            onChange={(e) => setPickerLang(e.target.value)}
          >
            <option value="">Translate to…</option>
            {LANGUAGES.filter((l) => !translationLangs.includes(l.name)).map(
              (l) => (
                <option key={l.code} value={l.name}>
                  {l.name}
                </option>
              ),
            )}
          </Select>
          <Button
            size="sm"
            busy={busy}
            disabled={!pickerLang}
            onClick={() => void translate(pickerLang)}
          >
            Translate
          </Button>
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}

      {active && (
        <div className="hidden grid-cols-2 gap-6 border-b border-line pb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft md:grid">
          <span>Original</span>
          <span>{activeLang}</span>
        </div>
      )}

      {/* Segments */}
      <div className="space-y-4">
        {t.segments.map((seg, i) => {
          const idx = speakerIndex(seg.speakerId);
          const name = speakerName(t, seg.speakerId);
          return (
            <div key={i} className="rise-in flex gap-3">
              <div
                className={cn(
                  "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white",
                  speakerColor(idx),
                )}
                title={name}
              >
                {initials(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{name}</span>
                  {seg.startSec !== undefined && (
                    <span className="font-mono text-[11px] text-ink-soft">
                      {fmtTime(seg.startSec)}
                    </span>
                  )}
                  {seg.language && (
                    <span className="text-[11px] text-gold">{seg.language}</span>
                  )}
                </div>
                {active ? (
                  <div className="mt-1 grid gap-2 md:grid-cols-2 md:gap-6">
                    <p className="text-[15px] leading-relaxed">{seg.text}</p>
                    <p className="border-l-2 border-accent/30 pl-3 text-[15px] leading-relaxed text-accent-deep md:border-l-0 md:pl-0 md:text-ink">
                      {active[i] ?? ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-[15px] leading-relaxed">{seg.text}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
