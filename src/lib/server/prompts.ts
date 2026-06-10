import "server-only";

import { Type, type Schema } from "@google/genai";
import type { LiveMode } from "@/lib/types";

export const transcriptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short descriptive title for the recording (max 8 words)",
    },
    languages: {
      type: Type.ARRAY,
      description: "Languages detected in the audio, English names",
      items: { type: Type.STRING },
    },
    speakers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Stable id, e.g. "S1"' },
          name: {
            type: Type.STRING,
            description:
              "Real name or role if identifiable from context, else omit",
          },
        },
        required: ["id"],
      },
    },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speakerId: { type: Type.STRING },
          startSec: {
            type: Type.NUMBER,
            description: "Start of the utterance in seconds",
          },
          endSec: { type: Type.NUMBER },
          text: { type: Type.STRING },
          language: {
            type: Type.STRING,
            description: "Language of this utterance, English name",
          },
        },
        required: ["speakerId", "text"],
      },
    },
  },
  required: ["title", "languages", "speakers", "segments"],
};

export function buildTranscriptionInstruction(opts: {
  languages: string[];
  speakerHints: string;
  hasContext: boolean;
}): string {
  const lines = [
    "You are an expert transcriptionist producing a verbatim, speaker-diarized transcript of the supplied recording.",
    "",
    "Rules:",
    "- Transcribe exactly what is said, in the original language and script of each utterance. Never translate.",
    "- Diarize: split the transcript into segments whenever the speaker changes, and assign each segment a stable speaker id (S1, S2, ...).",
    "- Provide startSec/endSec offsets in seconds for every segment, as accurately as possible.",
    "- Keep filler words only when meaningful; lightly clean stutters and false starts for readability without changing meaning.",
    "- For mixed-language speech, keep each utterance in its spoken language and label the segment's language.",
    "- Mark unintelligible passages as [inaudible].",
  ];
  if (opts.languages.length > 0) {
    lines.push(
      `- The recording is expected to contain: ${opts.languages.join(", ")}. Other languages may still occur.`,
    );
  }
  if (opts.hasContext) {
    lines.push(
      "- Context documents are attached (e.g. interview guides, participant lists, glossaries). Use them to: resolve domain terminology, spell names and product terms correctly, and identify who is speaking.",
      "- When the context lets you identify a speaker, set that speaker's name (e.g. \"Priya\", \"Moderator\"). Never invent names that the context does not support.",
    );
  }
  if (opts.speakerHints.trim()) {
    lines.push(
      `- The user provided these speaker hints: ${opts.speakerHints.trim()}`,
    );
  }
  return lines.join("\n");
}

export const translationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    translations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "One translation per input entry, same order",
    },
  },
  required: ["translations"],
};

export function buildTranslationInstruction(target: string): string {
  return [
    `You are a professional translator. Translate each entry of the JSON array the user provides into ${target}.`,
    "Rules:",
    "- Preserve meaning, tone, and register. Keep names, numbers, and product terms intact.",
    "- Entries already in the target language pass through unchanged.",
    "- Return exactly one translation per input entry, in the same order.",
  ].join("\n");
}

export function buildLiveInstruction(
  mode: LiveMode,
  sourceLanguages: string[],
  targetLanguages: string[],
): string {
  const sources =
    sourceLanguages.length > 0 ? sourceLanguages.join(", ") : "any language";

  if (mode === "transcribe") {
    return [
      "You are a silent transcription utility. The user's speech is transcribed automatically by the system;",
      "your replies are never shown. Do not answer questions, do not comment, do not translate.",
      "Whenever you are required to respond, respond with exactly: ·",
      `Expected spoken languages: ${sources}.`,
    ].join("\n");
  }

  const targets = targetLanguages.length > 0 ? targetLanguages : ["English"];
  const lines = [
    "You are a professional simultaneous interpreter.",
    `The audio contains speech in ${sources}.`,
    "Translate every utterance you hear, faithfully and completely. Do not answer questions or add commentary — only translate.",
  ];
  if (targets.length === 1) {
    lines.push(
      `Output the ${targets[0]} translation as plain text, nothing else.`,
    );
  } else {
    lines.push(
      `Translate into all of: ${targets.join(", ")}.`,
      "For each utterance output one line per target language, each prefixed with the language name in square brackets, e.g.:",
      `[${targets[0]}] ...translation...`,
      `[${targets[1]}] ...translation...`,
    );
  }
  if (mode === "tandem") {
    lines.push(
      "The source-language transcript is produced automatically by the system — output only translations.",
    );
  }
  return lines.join("\n");
}
