/**
 * AudioWorklet that converts the render-graph float stream into 16 kHz
 * 16-bit mono PCM chunks (~128 ms each) and posts them to the main thread.
 *
 * `sampleRate` is the AudioWorkletGlobalScope's context rate (often 48000).
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate =
      (options && options.processorOptions && options.processorOptions.targetRate) ||
      16000;
    this.ratio = sampleRate / this.targetRate;
    this.input = [];
    this.inputLength = 0;
    // Emit roughly 128 ms of 16 kHz audio per message.
    this.chunkInputSamples = Math.round(2048 * this.ratio);
  }

  flush() {
    const merged = new Float32Array(this.inputLength);
    let off = 0;
    for (const part of this.input) {
      merged.set(part, off);
      off += part.length;
    }
    this.input = [];
    this.inputLength = 0;

    const outLength = Math.floor(merged.length / this.ratio);
    const out = new Int16Array(outLength);
    for (let i = 0; i < outLength; i++) {
      // Average the source window to crudely low-pass before decimation.
      const start = Math.floor(i * this.ratio);
      const end = Math.min(merged.length, Math.floor((i + 1) * this.ratio));
      let sum = 0;
      let n = 0;
      for (let j = start; j < end; j++) {
        sum += merged[j];
        n++;
      }
      const s = n > 0 ? sum / n : 0;
      const clamped = Math.max(-1, Math.min(1, s));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    this.port.postMessage(out.buffer, [out.buffer]);
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      this.input.push(new Float32Array(channel));
      this.inputLength += channel.length;
      if (this.inputLength >= this.chunkInputSamples) this.flush();
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
