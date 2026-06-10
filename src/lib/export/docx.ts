/** DOCX export via the `docx` package (runs fully in the browser). */

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { SessionRecord } from "@/lib/types";
import { fmtTime } from "@/lib/utils";
import { speakerName } from "./format";

export async function sessionToDocx(s: SessionRecord): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({ text: s.title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${new Date(s.createdAt).toLocaleString()} · ${s.model}`,
          italics: true,
          color: "666666",
        }),
      ],
      spacing: { after: 300 },
    }),
  ];

  const segmentParagraph = (
    name: string,
    stamp: string | null,
    text: string,
  ) =>
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({ text: name, bold: true }),
        ...(stamp
          ? [new TextRun({ text: `  ${stamp}`, color: "888888", size: 18 })]
          : []),
        new TextRun({ break: 1 }),
        new TextRun({ text }),
      ],
    });

  if (s.transcript) {
    for (const seg of s.transcript.segments) {
      children.push(
        segmentParagraph(
          speakerName(s.transcript, seg.speakerId),
          seg.startSec !== undefined ? fmtTime(seg.startSec) : null,
          seg.text,
        ),
      );
    }
    for (const [lang, lines] of Object.entries(s.translations ?? {})) {
      children.push(
        new Paragraph({
          text: `Translation — ${lang}`,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );
      s.transcript.segments.forEach((seg, i) => {
        children.push(
          segmentParagraph(
            speakerName(s.transcript!, seg.speakerId),
            null,
            lines[i] ?? "",
          ),
        );
      });
    }
  }

  if (s.liveSource && s.liveSource.length > 0) {
    children.push(
      new Paragraph({
        text: "Transcript",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),
    );
    for (const line of s.liveSource) {
      children.push(
        segmentParagraph(fmtTime(line.at / 1000), null, line.text),
      );
    }
  }
  for (const [lang, lines] of Object.entries(s.liveTargets ?? {})) {
    children.push(
      new Paragraph({
        text: lang,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),
    );
    for (const line of lines) {
      children.push(
        segmentParagraph(fmtTime(line.at / 1000), null, line.text),
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
    creator: "Convo",
    title: s.title,
  });
  return Packer.toBlob(doc);
}
