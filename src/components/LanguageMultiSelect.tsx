"use client";

import { X } from "lucide-react";
import { Field, Select } from "@/components/ui";
import { LANGUAGES } from "@/lib/languages";

export function LanguageMultiSelect({
  label,
  hint,
  value,
  onChange,
  placeholder = "Add a language…",
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (langs: string[]) => void;
  placeholder?: string;
}) {
  const remaining = LANGUAGES.filter((l) => !value.includes(l.name));

  return (
    <Field label={label} hint={hint}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-deep"
            >
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onChange(value.filter((v) => v !== name))}
                className="rounded-full p-0.5 transition hover:bg-accent/15"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Select
        value=""
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value]);
        }}
      >
        <option value="">{placeholder}</option>
        {remaining.map((l) => (
          <option key={l.code} value={l.name}>
            {l.name} · {l.native}
          </option>
        ))}
      </Select>
    </Field>
  );
}
