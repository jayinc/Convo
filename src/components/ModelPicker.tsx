"use client";

import { Field, Select } from "@/components/ui";
import { MODELS, type Capability } from "@/lib/models";

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  deepgram: "Deepgram",
  anthropic: "Anthropic",
};

export function ModelPicker({
  capability,
  value,
  onChange,
  label = "Model",
}: {
  capability: Capability;
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const models = MODELS.filter((m) => m.capabilities.includes(capability));
  const providers = [...new Set(models.map((m) => m.provider))];
  const selected = models.find((m) => m.id === value);

  return (
    <Field label={label} hint={selected?.recommended ? "recommended" : undefined}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {providers.map((p) => (
          <optgroup key={p} label={PROVIDER_LABELS[p] ?? p}>
            {models
              .filter((m) => m.provider === p)
              .map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available}>
                  {m.label}
                  {!m.available ? " — coming soon" : ""}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
      {selected && (
        <p className="text-xs text-ink-soft">{selected.description}</p>
      )}
    </Field>
  );
}
