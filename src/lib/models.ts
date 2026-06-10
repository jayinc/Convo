/**
 * Provider-agnostic model registry backing the model picker.
 *
 * Gemini is fully wired today; other providers are declared so the picker
 * (and the adapter layer in src/lib/server + src/lib/live) has stable IDs to
 * grow into. Mark `available: true` once an adapter lands.
 */

export type Capability = "upload" | "live" | "translate";

export type Provider = "gemini" | "openai" | "deepgram" | "anthropic";

export interface ModelInfo {
  id: string;
  label: string;
  provider: Provider;
  capabilities: Capability[];
  description: string;
  recommended?: boolean;
  available: boolean;
}

export const MODELS: ModelInfo[] = [
  // --- Gemini: batch (upload) + translation ---
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    provider: "gemini",
    capabilities: ["upload", "translate"],
    description: "Fast multimodal default — strong diarization, 1M context",
    recommended: true,
    available: true,
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (preview)",
    provider: "gemini",
    capabilities: ["upload", "translate"],
    description: "Highest accuracy for difficult, mixed-language audio",
    available: true,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    capabilities: ["upload", "translate"],
    description: "Previous-generation Pro — stable fallback",
    available: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    capabilities: ["upload", "translate"],
    description: "Previous-generation Flash — cheapest option",
    available: true,
  },
  // --- Gemini: Live API (real-time) ---
  {
    id: "gemini-3.1-flash-live-preview",
    label: "Gemini 3.1 Flash Live",
    provider: "gemini",
    capabilities: ["live"],
    description: "Low-latency realtime — transcription & tandem sessions",
    recommended: true,
    available: true,
  },
  {
    id: "gemini-3.5-live-translate-preview",
    label: "Gemini 3.5 Live Translate",
    provider: "gemini",
    capabilities: ["live"],
    description: "Purpose-built streaming translation across 70+ languages",
    available: true,
  },
  // --- Future adapters (visible in picker, disabled) ---
  {
    id: "gpt-4o-transcribe",
    label: "GPT-4o Transcribe",
    provider: "openai",
    capabilities: ["upload"],
    description: "OpenAI speech-to-text (adapter not wired yet)",
    available: false,
  },
  {
    id: "nova-3",
    label: "Deepgram Nova-3",
    provider: "deepgram",
    capabilities: ["live", "upload"],
    description: "Specialist streaming STT (adapter not wired yet)",
    available: false,
  },
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "anthropic",
    capabilities: ["translate"],
    description: "Premium translation & speaker naming (adapter not wired yet)",
    available: false,
  },
];

export const DEFAULT_UPLOAD_MODEL = "gemini-3.5-flash";
export const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";
export const DEFAULT_LIVE_TRANSLATE_MODEL = "gemini-3.5-live-translate-preview";

export function modelsFor(capability: Capability): ModelInfo[] {
  return MODELS.filter((m) => m.capabilities.includes(capability));
}

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

/** Server-side guard: only allow models we have an adapter for. */
export function isAllowedModel(id: string, capability: Capability): boolean {
  const m = MODELS.find((x) => x.id === id);
  return !!m && m.available && m.capabilities.includes(capability);
}
