"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn, fmtBytes } from "@/lib/utils";

export function FileDrop({
  accept,
  multiple = false,
  files,
  onFiles,
  onRemove,
  icon,
  title,
  hint,
  compact = false,
}: {
  accept?: string;
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  icon?: ReactNode;
  title: string;
  hint?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    onFiles(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "w-full rounded-2xl border-2 border-dashed transition",
          compact ? "px-4 py-4" : "px-6 py-8",
          over
            ? "border-accent bg-accent-soft/60"
            : "border-line bg-paper-2/40 hover:border-accent/50 hover:bg-accent-soft/30",
        )}
      >
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="text-accent">
            {icon ?? <UploadCloud className={compact ? "h-5 w-5" : "h-7 w-7"} />}
          </span>
          <span className={cn("font-medium", compact ? "text-sm" : "text-base")}>
            {title}
          </span>
          {hint && <span className="text-xs text-ink-soft">{hint}</span>}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-ink-soft">
                {fmtBytes(f.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onRemove(i)}
                className="shrink-0 rounded-lg p-1 text-ink-soft transition hover:bg-paper-2 hover:text-rec"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
