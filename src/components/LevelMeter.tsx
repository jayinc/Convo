"use client";

import { useEffect, useRef } from "react";

/** Small animated bar meter driven by an AnalyserNode. */
export function LevelMeter({ analyser }: { analyser: AnalyserNode | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const BARS = 24;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const step = Math.floor(data.length / BARS);
      const barW = width / BARS;
      for (let i = 0; i < BARS; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j];
        const v = sum / step / 255;
        const h = Math.max(2, v * height);
        ctx.fillStyle = `rgba(12, 110, 100, ${0.35 + v * 0.65})`;
        ctx.fillRect(i * barW + 1, height - h, barW - 2, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return (
    <canvas
      ref={ref}
      width={192}
      height={28}
      className="h-7 w-48 rounded-lg bg-paper-2"
    />
  );
}
