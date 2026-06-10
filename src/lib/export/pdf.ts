/**
 * PDF export via the browser's print engine: we render a print-styled
 * document in a hidden window and invoke print -> "Save as PDF".
 *
 * Why not jsPDF? The browser's text shaping handles every script
 * (Devanagari, CJK, Arabic, ...) without bundling fonts — essential for a
 * multilingual transcription tool.
 */

import type { SessionRecord } from "@/lib/types";
import { fmtTime } from "@/lib/utils";
import { speakerName } from "./format";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function segmentHtml(name: string, stamp: string | null, text: string): string {
  return `<div class="seg">
    <div class="meta"><span class="name">${esc(name)}</span>${stamp ? `<span class="stamp">${esc(stamp)}</span>` : ""}</div>
    <div class="text">${esc(text)}</div>
  </div>`;
}

export function exportPdf(s: SessionRecord): void {
  const blocks: string[] = [];

  if (s.transcript) {
    for (const seg of s.transcript.segments) {
      blocks.push(
        segmentHtml(
          speakerName(s.transcript, seg.speakerId),
          seg.startSec !== undefined ? fmtTime(seg.startSec) : null,
          seg.text,
        ),
      );
    }
    for (const [lang, lines] of Object.entries(s.translations ?? {})) {
      blocks.push(`<h2>Translation — ${esc(lang)}</h2>`);
      s.transcript.segments.forEach((seg, i) => {
        blocks.push(
          segmentHtml(
            speakerName(s.transcript!, seg.speakerId),
            null,
            lines[i] ?? "",
          ),
        );
      });
    }
  }
  if (s.liveSource && s.liveSource.length > 0) {
    blocks.push("<h2>Transcript</h2>");
    for (const line of s.liveSource) {
      blocks.push(segmentHtml(fmtTime(line.at / 1000), null, line.text));
    }
  }
  for (const [lang, lines] of Object.entries(s.liveTargets ?? {})) {
    blocks.push(`<h2>${esc(lang)}</h2>`);
    for (const line of lines) {
      blocks.push(segmentHtml(fmtTime(line.at / 1000), null, line.text));
    }
  }

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(s.title)}</title>
<style>
  @page { margin: 22mm 18mm; }
  body { font-family: Georgia, "Noto Serif", serif; color: #1a1814; line-height: 1.55; }
  h1 { font-size: 22pt; margin: 0 0 2pt; }
  h2 { font-size: 14pt; margin: 18pt 0 8pt; border-bottom: 1px solid #ddd; padding-bottom: 4pt; }
  .sub { color: #777; font-size: 9.5pt; margin-bottom: 18pt; }
  .seg { margin-bottom: 9pt; page-break-inside: avoid; }
  .meta { font-size: 9pt; margin-bottom: 1pt; }
  .name { font-weight: 700; letter-spacing: 0.02em; }
  .stamp { color: #999; margin-left: 8pt; font-family: ui-monospace, monospace; font-size: 8pt; }
  .text { font-size: 10.5pt; }
</style>
</head>
<body>
  <h1>${esc(s.title)}</h1>
  <div class="sub">${esc(new Date(s.createdAt).toLocaleString())} · ${esc(s.model)} · made with Convo</div>
  ${blocks.join("\n")}
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},150);});</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Pop-up blocked — allow pop-ups to export PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
}
