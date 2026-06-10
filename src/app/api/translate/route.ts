import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/server/gemini";
import {
  buildTranslationInstruction,
  translationSchema,
} from "@/lib/server/prompts";
import { DEFAULT_UPLOAD_MODEL, isAllowedModel } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      texts?: string[];
      targetLanguage?: string;
      model?: string;
    };
    const texts = body.texts;
    const target = body.targetLanguage?.trim();
    if (!Array.isArray(texts) || texts.length === 0 || !target) {
      return NextResponse.json(
        { error: "Expected { texts: string[], targetLanguage: string }" },
        { status: 400 },
      );
    }
    const model =
      body.model && isAllowedModel(body.model, "translate")
        ? body.model
        : DEFAULT_UPLOAD_MODEL;

    const ai = getClient();
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify(texts) }],
        },
      ],
      config: {
        systemInstruction: buildTranslationInstruction(target),
        responseMimeType: "application/json",
        responseSchema: translationSchema,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text) throw new Error("The model returned an empty response");
    const parsed = JSON.parse(text) as { translations?: string[] };
    const translations = parsed.translations ?? [];
    // Length-align defensively so the UI can zip with segments.
    while (translations.length < texts.length) translations.push("");
    return NextResponse.json({ translations: translations.slice(0, texts.length) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
