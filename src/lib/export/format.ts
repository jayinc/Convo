/** Plain-text style exports: TXT, SRT, VTT. */

import type { SessionRecord, TranscriptResult } from "@/lib/types";
import { fmtTime } from "@/lib/utils";

export function speakerName(t: TranscriptResult, id: string): string {
  const s = t.speakers.find((x) => x.id === id);
  if (s?.name) return s.name;
  const index = t.speakers.findIndex((x) => x.id === id);
  return `Speaker ${index >= 0 ? index + 1 : id.replace(/\D/g, "") || "?"}`;
}

export function sessionToText(s: SessionRecord): string {
  const out: string[] = [s.title, new Date(s.createdAt).toLocaleString(), ""];
  if (s.transcript) {
    for (const seg of s.transcript.segments) {
      const name = speakerName(s.transcript, seg.speakerId);
      const stamp = seg.startSec !== undefined ? ` [${fmtTime(seg.startSec)}]` : "";
      out.push(`${name}${stamp}: ${seg.text}`);
    }
    for (const [lang, lines] of Object.entries(s.translations ?? {})) {
      out.push("", `--- Translation (${lang}) ---`, "");
      s.transcript.segments.forEach((seg, i) => {
        const name = speakerName(s.transcript!, seg.speakerId);
        out.push(`${name}: ${lines[i] ?? ""}`);
      });
    }
  }
  if (s.liveSource && s.liveSource.length > 0) {
    out.push("--- Transcript ---", "");
    for (const line of s.liveSource) {
      out.push(`[${fmtTime(line.at / 1000)}] ${line.text}`);
    }
  }
  for (const [lang, lines] of Object.entries(s.liveTargets ?? {})) {
    out.push("", `--- ${lang} ---`, "");
    for (const line of lines) {
      out.push(`[${fmtTime(line.at / 1000)}] ${line.text}`);
    }
  }
  return out.join("\n") + "\n";
}

function srtStamp(sec: number, sep: string): string {
  const ms = Math.round((sec % 1) * 1000);
  const s = Math.floor(sec);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}${sep}${String(ms).padStart(3, "0")}`;
}

interface Cue {
  start: number;
  end: number;
  text: string;
}

function sessionCues(s: SessionRecord): Cue[] | null {
  if (s.transcript) {
    const segs = s.transcript.segments.filter(
      (x) => typeof x.startSec === "number",
    );
    if (segs.length === 0) return null;
    return segs.map((seg, i) => ({
      start: seg.startSec!,
      end:
        typeof seg.endSec === "number"
          ? seg.endSec
          : (segs[i + 1]?.startSec ?? seg.startSec! + 4),
      text: `${speakerName(s.transcript!, seg.speakerId)}: ${seg.text}`,
    }));
  }
  if (s.liveSource && s.liveSource.length > 0) {
    return s.liveSource.map((line, i) => ({
      start: line.at / 1000,
      end: (s.liveSource![i + 1]?.at ?? line.at + 4000) / 1000,
      text: line.text,
    }));
  }
  return null;
}

export function sessionToSrt(s: SessionRecord): string | null {
  const cues = sessionCues(s);
  if (!cues) return null;
  return (
    cues
      .map(
        (c, i) =>
          `${i + 1}\n${srtStamp(c.start, ",")} --> ${srtStamp(c.end, ",")}\n${c.text}`,
      )
      .join("\n\n") + "\n"
  );
}

export function sessionToVtt(s: SessionRecord): string | null {
  const cues = sessionCues(s);
  if (!cues) return null;
  return (
    "WEBVTT\n\n" +
    cues
      .map((c) => `${srtStamp(c.start, ".")} --> ${srtStamp(c.end, ".")}\n${c.text}`)
      .join("\n\n") +
    "\n"
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function safeFilename(title: string): string {
  return (
    title
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "convo-session"
  );
}
