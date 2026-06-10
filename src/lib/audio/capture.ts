/**
 * Live audio capture: microphone or browser tab, normalized to 16 kHz
 * 16-bit mono PCM chunks via an AudioWorklet.
 */

import type { AudioSource } from "@/lib/types";

export interface CaptureHandle {
  /** Hooked to an AnalyserNode for level metering. */
  analyser: AnalyserNode;
  stop(): void;
}

export async function startCapture(
  source: AudioSource,
  onChunk: (pcm16: ArrayBuffer) => void,
): Promise<CaptureHandle> {
  let stream: MediaStream;
  if (source === "mic") {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } else {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    // We only want the audio; release the video track immediately.
    stream.getVideoTracks().forEach((t) => t.stop());
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(
        'No tab audio shared. Pick a browser tab and tick "Also share tab audio" in the share dialog.',
      );
    }
  }

  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule("/worklets/pcm-processor.js");

  const srcNode = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;

  const worklet = new AudioWorkletNode(ctx, "pcm-processor", {
    processorOptions: { targetRate: 16000 },
  });
  worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onChunk(e.data);

  srcNode.connect(analyser);
  srcNode.connect(worklet);
  // Keep the worklet in the render graph without producing audible output.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  worklet.connect(mute);
  mute.connect(ctx.destination);

  let stopped = false;
  return {
    analyser,
    stop() {
      if (stopped) return;
      stopped = true;
      worklet.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

/** Base64-encode a PCM chunk for the websocket payload. */
export function chunkToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}
