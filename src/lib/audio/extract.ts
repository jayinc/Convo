/**
 * Client-side audio extraction. When the user uploads a video we strip the
 * audio track in the browser (decode -> downmix to 16 kHz mono -> WAV) so
 * only audio goes over the wire. Falls back to the original file when the
 * browser can't decode the container.
 */

import { encodeWav } from "./wav";

const TARGET_RATE = 16000;

export function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|m4v|mov|webm|mkv|avi|mpg|mpeg)$/i.test(file.name)
  );
}

export interface ExtractResult {
  blob: Blob;
  mimeType: string;
  filename: string;
  durationSec?: number;
  extracted: boolean;
}

export async function prepareMedia(file: File): Promise<ExtractResult> {
  if (!isVideoFile(file)) {
    return {
      blob: file,
      mimeType: file.type || "audio/mpeg",
      filename: file.name,
      extracted: false,
    };
  }
  try {
    const arrayBuf = await file.arrayBuffer();
    const Ctx: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const probe = new Ctx();
    let decoded: AudioBuffer;
    try {
      decoded = await probe.decodeAudioData(arrayBuf);
    } finally {
      void probe.close();
    }
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * TARGET_RATE),
      TARGET_RATE,
    );
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    const blob = encodeWav(rendered.getChannelData(0), TARGET_RATE);
    return {
      blob,
      mimeType: "audio/wav",
      filename: file.name.replace(/\.[^.]+$/, "") + ".wav",
      durationSec: decoded.duration,
      extracted: true,
    };
  } catch {
    // Browser couldn't decode this container — let the model ingest the
    // original file directly (Gemini accepts video natively).
    return {
      blob: file,
      mimeType: file.type || "video/mp4",
      filename: file.name,
      extracted: false,
    };
  }
}
