import { NextRequest, NextResponse } from "next/server";
import type { Part } from "@google/genai";
import { getClient, mediaToPart } from "@/lib/server/gemini";
import { contextFileToParts } from "@/lib/server/context";
import {
  buildTranscriptionInstruction,
  transcriptionSchema,
} from "@/lib/server/prompts";
import { DEFAULT_UPLOAD_MODEL, isAllowedModel } from "@/lib/models";
import type { TranscriptResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RawTranscript {
  title?: string;
  languages?: string[];
  speakers?: { id?: string; name?: string }[];
  segments?: {
    speakerId?: string;
    startSec?: number;
    endSec?: number;
    text?: string;
    language?: string;
  }[];
}

function sanitize(raw: RawTranscript, fallbackTitle: string): TranscriptResult {
  const segments = (raw.segments ?? [])
    .filter((s) => typeof s.text === "string" && s.text.trim().length > 0)
    .map((s) => ({
      speakerId: s.speakerId || "S1",
      startSec: typeof s.startSec === "number" ? s.startSec : undefined,
      endSec: typeof s.endSec === "number" ? s.endSec : undefined,
      text: s.text!.trim(),
      language: s.language,
    }));
  const speakerIds = new Set(segments.map((s) => s.speakerId));
  const speakers: { id: string; name?: string }[] = (raw.speakers ?? [])
    .filter((s) => s.id)
    .map((s) => ({ id: s.id!, name: s.name }));
  for (const id of speakerIds) {
    if (!speakers.some((s) => s.id === id)) speakers.push({ id });
  }
  return {
    title: raw.title?.trim() || fallbackTitle,
    languages: raw.languages ?? [],
    speakers,
    segments,
  };
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const media = form.get("media");
    if (!(media instanceof File)) {
      return NextResponse.json(
        { error: "No media file provided" },
        { status: 400 },
      );
    }
    const model = String(form.get("model") || DEFAULT_UPLOAD_MODEL);
    if (!isAllowedModel(model, "upload")) {
      return NextResponse.json(
        { error: `Model "${model}" is not available for transcription` },
        { status: 400 },
      );
    }
    const languages = String(form.get("languages") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const speakerHints = String(form.get("speakerHints") || "");
    const mimeType = String(form.get("mimeType") || media.type || "");

    const ai = getClient();
    const warnings: string[] = [];

    const parts: Part[] = [await mediaToPart(ai, media, mimeType)];

    const contextFiles = form
      .getAll("context")
      .filter((f): f is File => f instanceof File);
    for (const f of contextFiles) {
      const p = await contextFileToParts(f);
      if (p) parts.push(...p);
      else warnings.push(`Could not read context file "${f.name}" — skipped.`);
    }

    parts.push({
      text: "Transcribe the attached recording following your instructions. Return the structured transcript.",
    });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: buildTranscriptionInstruction({
          languages,
          speakerHints,
          hasContext: contextFiles.length > 0,
        }),
        responseMimeType: "application/json",
        responseSchema: transcriptionSchema,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) throw new Error("The model returned an empty response");
    const transcript = sanitize(
      JSON.parse(text) as RawTranscript,
      media.name.replace(/\.[^.]+$/, ""),
    );
    return NextResponse.json({ transcript, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
