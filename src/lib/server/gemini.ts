import "server-only";

import { GoogleGenAI, createPartFromUri, type Part } from "@google/genai";

export function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env.local and add your key.",
    );
  }
  return key;
}

export function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

/** v1alpha client — required for ephemeral auth tokens (Live API). */
export function getAlphaClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: getApiKey(),
    httpOptions: { apiVersion: "v1alpha" },
  });
}

/** Requests under this size are sent inline; larger media goes through the Files API. */
const INLINE_LIMIT = 15 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mediaToPart(
  ai: GoogleGenAI,
  blob: Blob,
  mimeType?: string,
): Promise<Part> {
  const type =
    mimeType ||
    (blob as File).type ||
    "application/octet-stream";

  if (blob.size <= INLINE_LIMIT) {
    const data = Buffer.from(await blob.arrayBuffer()).toString("base64");
    return { inlineData: { data, mimeType: type } };
  }

  let file = await ai.files.upload({ file: blob, config: { mimeType: type } });
  const deadline = Date.now() + 180_000;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await sleep(2000);
    file = await ai.files.get({ name: file.name! });
  }
  if (file.state !== "ACTIVE" || !file.uri) {
    throw new Error(
      `Media upload did not become ready (state: ${file.state ?? "unknown"})`,
    );
  }
  return createPartFromUri(file.uri, file.mimeType ?? type);
}
