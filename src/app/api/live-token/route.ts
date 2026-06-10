import { NextRequest, NextResponse } from "next/server";
import { getAlphaClient, getApiKey } from "@/lib/server/gemini";
import { buildLiveInstruction } from "@/lib/server/prompts";
import {
  DEFAULT_LIVE_MODEL,
  DEFAULT_LIVE_TRANSLATE_MODEL,
  isAllowedModel,
} from "@/lib/models";
import type { LiveMode } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Mints a short-lived ephemeral token so the browser can open a Live API
 * websocket directly with Google — the long-lived API key never leaves the
 * server. Also returns the session config (system instruction, modalities)
 * so prompt logic stays server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      mode?: LiveMode;
      model?: string;
      sourceLanguages?: string[];
      targetLanguages?: string[];
    };
    const mode: LiveMode = body.mode ?? "transcribe";
    const sourceLanguages = body.sourceLanguages ?? [];
    const targetLanguages = body.targetLanguages ?? [];

    const model =
      body.model && isAllowedModel(body.model, "live")
        ? body.model
        : mode === "translate"
          ? DEFAULT_LIVE_TRANSLATE_MODEL
          : DEFAULT_LIVE_MODEL;

    const config = {
      responseModalities: ["TEXT"],
      inputAudioTranscription: {},
      systemInstruction: buildLiveInstruction(
        mode,
        sourceLanguages,
        targetLanguages,
      ),
    };

    const ai = getAlphaClient();
    try {
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        },
      });
      if (!token.name) throw new Error("Token creation returned no name");
      return NextResponse.json({ token: token.name, model, config });
    } catch (tokenErr) {
      // Local-dev escape hatch only: expose the raw key to the browser when
      // explicitly enabled. Never enable this on a deployed instance.
      if (process.env.GEMINI_ALLOW_BROWSER_KEY === "true") {
        return NextResponse.json({
          token: getApiKey(),
          model,
          config,
          insecure: true,
        });
      }
      throw tokenErr;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
