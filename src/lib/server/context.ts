import "server-only";

import mammoth from "mammoth";
import type { Part } from "@google/genai";

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|csv|tsv|json|ya?ml|xml|html?|rtf|srt|vtt|log)$/i;
const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function extension(name: string): string {
  const m = /\.[^.]+$/.exec(name.toLowerCase());
  return m ? m[0] : "";
}

/** Heuristic: treat the buffer as text when it decodes cleanly as UTF-8. */
function tryDecodeText(buf: Buffer): string | null {
  const sample = buf.subarray(0, 64 * 1024);
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(sample);
  const bad = (decoded.match(/�/g) ?? []).length;
  if (decoded.length === 0 || bad / decoded.length > 0.02) return null;
  return new TextDecoder("utf-8").decode(buf);
}

/**
 * Convert an arbitrary context document into model parts. Returns null when
 * the file format can't be read (caller surfaces a warning).
 */
export async function contextFileToParts(file: File): Promise<Part[] | null> {
  const ext = extension(file.name);
  const buf = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || ext === ".pdf") {
    return [
      { text: `Context document: ${file.name}` },
      { inlineData: { data: buf.toString("base64"), mimeType: "application/pdf" } },
    ];
  }

  if (IMAGE_TYPES[ext] || file.type.startsWith("image/")) {
    const mime = file.type || IMAGE_TYPES[ext];
    return [
      { text: `Context document (image): ${file.name}` },
      { inlineData: { data: buf.toString("base64"), mimeType: mime } },
    ];
  }

  if (
    ext === ".docx" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return [{ text: `Context document: ${file.name}\n\n${value}` }];
    } catch {
      return null;
    }
  }

  if (TEXT_EXTENSIONS.test(file.name) || file.type.startsWith("text/")) {
    const text = tryDecodeText(buf);
    if (text !== null) {
      return [{ text: `Context document: ${file.name}\n\n${text}` }];
    }
    return null;
  }

  // Unknown format — accept it if it happens to be readable text.
  const text = tryDecodeText(buf);
  if (text !== null) {
    return [{ text: `Context document: ${file.name}\n\n${text}` }];
  }
  return null;
}
