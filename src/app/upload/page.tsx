"use client";

import { useState } from "react";
import { BookOpenText, FileAudio, Sparkles } from "lucide-react";
import { Button, Card, ErrorNote, Field } from "@/components/ui";
import { FileDrop } from "@/components/FileDrop";
import { LanguageMultiSelect } from "@/components/LanguageMultiSelect";
import { ModelPicker } from "@/components/ModelPicker";
import { TranscriptWorkspace } from "@/components/TranscriptWorkspace";
import { prepareMedia } from "@/lib/audio/extract";
import { DEFAULT_UPLOAD_MODEL } from "@/lib/models";
import { saveSession } from "@/lib/store";
import type { SessionRecord, TranscribeResponse } from "@/lib/types";
import { uid } from "@/lib/utils";

export default function UploadPage() {
  const [media, setMedia] = useState<File[]>([]);
  const [contextFiles, setContextFiles] = useState<File[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [speakerHints, setSpeakerHints] = useState("");
  const [model, setModel] = useState(DEFAULT_UPLOAD_MODEL);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [session, setSession] = useState<SessionRecord | null>(null);

  const busy = phase !== null;

  const transcribe = async () => {
    const file = media[0];
    if (!file) return;
    setError(null);
    setWarnings([]);
    try {
      setPhase("Preparing media…");
      const prepared = await prepareMedia(file);
      if (prepared.extracted) {
        setPhase("Audio extracted from video — uploading…");
      }

      const form = new FormData();
      form.append(
        "media",
        new File([prepared.blob], prepared.filename, {
          type: prepared.mimeType,
        }),
      );
      form.append("mimeType", prepared.mimeType);
      form.append("model", model);
      form.append("languages", languages.join(","));
      form.append("speakerHints", speakerHints);
      for (const f of contextFiles) form.append("context", f);

      setPhase("Transcribing — long recordings can take a few minutes…");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as TranscribeResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Transcription failed");

      const record: SessionRecord = {
        id: uid(),
        kind: "upload",
        title: data.transcript.title,
        createdAt: Date.now(),
        model,
        sourceLanguages: data.transcript.languages,
        transcript: data.transcript,
        translations: {},
        mediaName: file.name,
        durationSec: prepared.durationSec,
      };
      await saveSession(record);
      setWarnings(data.warnings ?? []);
      setSession(record);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhase(null);
    }
  };

  if (session) {
    return (
      <div className="space-y-6">
        {warnings.length > 0 && (
          <div className="rounded-xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-gold">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}
        <TranscriptWorkspace
          session={session}
          onChange={(s) => {
            setSession(s);
            void saveSession(s);
          }}
        />
        <div className="border-t border-line pt-4">
          <Button
            variant="secondary"
            onClick={() => {
              setSession(null);
              setMedia([]);
            }}
          >
            New transcription
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Transcribe a recording
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Audio or video, any language — videos have their audio stripped right
          in your browser before upload.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: media + context */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="space-y-4 p-5">
            <Field
              label="Recording"
              hint="audio or video · large files use resumable upload"
            >
              <FileDrop
                accept="audio/*,video/*"
                files={media}
                onFiles={setMedia}
                onRemove={() => setMedia([])}
                icon={<FileAudio className="h-7 w-7" />}
                title="Drop your audio or video here"
                hint="MP3, WAV, M4A, MP4, MOV, WebM and more"
              />
            </Field>
          </Card>

          <Card className="space-y-4 p-5">
            <Field
              label="Context documents"
              hint="optional — boosts accuracy"
            >
              <FileDrop
                multiple
                compact
                files={contextFiles}
                onFiles={setContextFiles}
                onRemove={(i) =>
                  setContextFiles(contextFiles.filter((_, x) => x !== i))
                }
                icon={<BookOpenText className="h-5 w-5" />}
                title="Add interview guides, glossaries, participant lists…"
                hint="PDF, DOCX, TXT, MD, CSV, images — any format"
              />
            </Field>
            <p className="text-xs leading-relaxed text-ink-soft">
              Context grounds the transcription: domain terms get spelled
              correctly, mixed-language passages are handled better, and
              speakers are labeled with their real names when the documents
              reveal who is talking.
            </p>
          </Card>
        </div>

        {/* Right: settings */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-5 p-5">
            <LanguageMultiSelect
              label="Languages in the recording"
              hint="optional — auto-detected"
              value={languages}
              onChange={setLanguages}
            />
            <Field label="Speaker hints" hint="optional">
              <textarea
                value={speakerHints}
                onChange={(e) => setSpeakerHints(e.target.value)}
                rows={3}
                placeholder={
                  "e.g. Moderator is Sarah; participant is a nurse named Joaquín"
                }
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </Field>
            <ModelPicker
              capability="upload"
              value={model}
              onChange={setModel}
            />
          </Card>

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button
            size="lg"
            className="w-full"
            disabled={media.length === 0}
            busy={busy}
            onClick={() => void transcribe()}
          >
            {!busy && <Sparkles className="h-4 w-4" />}
            {phase ?? "Transcribe"}
          </Button>
        </div>
      </div>
    </div>
  );
}
