/**
 * Browser-side Live API connection. The server mints a single-use ephemeral
 * token (`/api/live-token`) plus the session config; the browser then opens
 * the websocket directly with Google so audio doesn't proxy through us.
 */

import {
  GoogleGenAI,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { chunkToBase64 } from "@/lib/audio/capture";
import type { LiveMode } from "@/lib/types";

export interface LiveHandlers {
  /** Incremental source-language transcription of the audio input. */
  onSourceDelta(text: string): void;
  /** Incremental model output (translations) or output transcription. */
  onTargetDelta(text: string): void;
  /** A turn finished — current lines should be committed. */
  onCommit(): void;
  onOpen(): void;
  onError(message: string): void;
  onClose(reason?: string): void;
}

export interface LiveConnectOptions {
  mode: LiveMode;
  model?: string;
  sourceLanguages: string[];
  targetLanguages: string[];
}

export interface LiveConnection {
  model: string;
  /** True when the server fell back to exposing the raw key (dev only). */
  insecure: boolean;
  sendChunk(pcm16: ArrayBuffer): void;
  close(): void;
}

export async function connectLive(
  opts: LiveConnectOptions,
  h: LiveHandlers,
): Promise<LiveConnection> {
  const res = await fetch("/api/live-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = (await res.json()) as {
    token?: string;
    model?: string;
    config?: unknown;
    insecure?: boolean;
    error?: string;
  };
  if (!res.ok || !data.token || !data.model) {
    throw new Error(data.error || "Failed to start a live session");
  }

  const ai = new GoogleGenAI({
    apiKey: data.token,
    httpOptions: { apiVersion: "v1alpha" },
  });

  let closed = false;
  const session: Session = await ai.live.connect({
    model: data.model,
    config: data.config as LiveConnectConfig,
    callbacks: {
      onopen: () => h.onOpen(),
      onmessage: (m: LiveServerMessage) => {
        const sc = m.serverContent;
        if (!sc) return;
        if (sc.inputTranscription?.text) {
          h.onSourceDelta(sc.inputTranscription.text);
        }
        if (sc.outputTranscription?.text) {
          h.onTargetDelta(sc.outputTranscription.text);
        }
        for (const p of sc.modelTurn?.parts ?? []) {
          if (p.text) h.onTargetDelta(p.text);
        }
        if (sc.turnComplete) h.onCommit();
      },
      onerror: (e: ErrorEvent) =>
        h.onError(e?.message || "Live connection error"),
      onclose: (e: CloseEvent) => {
        if (!closed) h.onClose(e?.reason || undefined);
      },
    },
  });

  return {
    model: data.model,
    insecure: !!data.insecure,
    sendChunk(pcm16: ArrayBuffer) {
      try {
        session.sendRealtimeInput({
          audio: {
            data: chunkToBase64(pcm16),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      } catch {
        // Session already closing — drop the chunk.
      }
    },
    close() {
      closed = true;
      try {
        session.close();
      } catch {
        // already closed
      }
    },
  };
}
