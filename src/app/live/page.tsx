"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Captions,
  Languages,
  Mic,
  MonitorSpeaker,
  Play,
  Square,
  SplitSquareHorizontal,
} from "lucide-react";
import { Badge, Button, Card, ErrorNote } from "@/components/ui";
import { LanguageMultiSelect } from "@/components/LanguageMultiSelect";
import { LevelMeter } from "@/components/LevelMeter";
import { ModelPicker } from "@/components/ModelPicker";
import { startCapture, type CaptureHandle } from "@/lib/audio/capture";
import { connectLive, type LiveConnection } from "@/lib/live/client";
import {
  DEFAULT_LIVE_MODEL,
  DEFAULT_LIVE_TRANSLATE_MODEL,
  modelLabel,
} from "@/lib/models";
import { saveSession } from "@/lib/store";
import type { AudioSource, LiveLine, LiveMode, SessionRecord } from "@/lib/types";
import { cn, fmtTime, uid } from "@/lib/utils";

type Stage = "setup" | "connecting" | "live" | "saving";

interface PanelData {
  lines: LiveLine[];
  current: string;
}

const EMPTY_PANEL: PanelData = { lines: [], current: "" };

const MODE_META: Record<
  LiveMode,
  { label: string; description: string; icon: typeof Captions }
> = {
  transcribe: {
    label: "Transcription",
    description: "Verbatim transcript of everything heard, as it's spoken.",
    icon: Captions,
  },
  translate: {
    label: "Translation",
    description: "Hear one language, read another — streaming interpretation.",
    icon: Languages,
  },
  tandem: {
    label: "Tandem",
    description: "Transcript and translation stream side-by-side in realtime.",
    icon: SplitSquareHorizontal,
  },
};

function LivePanel({
  title,
  data,
  accent = false,
}: {
  title: string;
  data: PanelData;
  accent?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });
  return (
    <div className="flex min-h-[40vh] min-w-0 flex-1 flex-col rounded-2xl border border-line bg-card shadow-card">
      <div
        className={cn(
          "flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider",
          accent ? "text-accent-deep" : "text-ink-soft",
        )}
      >
        {title}
      </div>
      <div
        ref={bodyRef}
        className="max-h-[58vh] flex-1 space-y-2.5 overflow-y-auto px-4 py-3"
      >
        {data.lines.map((l, i) => (
          <p key={i} className="rise-in text-[15px] leading-relaxed">
            <span className="mr-2 font-mono text-[11px] text-ink-soft">
              {fmtTime(l.at / 1000)}
            </span>
            {l.text}
          </p>
        ))}
        {data.current && (
          <p className="stream-caret text-[15px] leading-relaxed text-ink-soft">
            {data.current}
          </p>
        )}
        {data.lines.length === 0 && !data.current && (
          <p className="text-sm italic text-ink-soft/70">Listening…</p>
        )}
      </div>
    </div>
  );
}

export default function LivePage() {
  const router = useRouter();

  // --- setup state ---
  const [mode, setMode] = useState<LiveMode>("transcribe");
  const [sourceLangs, setSourceLangs] = useState<string[]>([]);
  const [targetLangs, setTargetLangs] = useState<string[]>(["English"]);
  const [audioSource, setAudioSource] = useState<AudioSource>("mic");
  const [model, setModel] = useState(DEFAULT_LIVE_MODEL);
  const [modelTouched, setModelTouched] = useState(false);

  // --- session state ---
  const [stage, setStage] = useState<Stage>("setup");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [activeModel, setActiveModel] = useState(model);
  const [sessionMeta, setSessionMeta] = useState<{
    mode: LiveMode;
    targets: string[];
  }>({ mode: "transcribe", targets: [] });

  // Render copies of the streaming panels.
  const [sourcePanel, setSourcePanel] = useState<PanelData>(EMPTY_PANEL);
  const [targetPanels, setTargetPanels] = useState<Record<string, PanelData>>({});

  // Streaming accumulators live in refs — events arrive faster than React
  // state settles and `stop()` needs the final data synchronously. Refs are
  // the source of truth; `syncPanels` mirrors them into render state.
  const sourceRef = useRef<PanelData>({ lines: [], current: "" });
  const targetsRef = useRef<Map<string, PanelData>>(new Map());
  const targetBufRef = useRef("");
  const metaRef = useRef<{ mode: LiveMode; targets: string[] }>({
    mode: "transcribe",
    targets: [],
  });
  const startTimeRef = useRef(0);
  const connRef = useRef<LiveConnection | null>(null);
  const capRef = useRef<CaptureHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  const syncPanels = useCallback(() => {
    setSourcePanel({
      lines: [...sourceRef.current.lines],
      current: sourceRef.current.current,
    });
    const t: Record<string, PanelData> = {};
    for (const [k, v] of targetsRef.current) {
      t[k] = { lines: [...v.lines], current: v.current };
    }
    setTargetPanels(t);
  }, []);

  const changeMode = (m: LiveMode) => {
    setMode(m);
    if (!modelTouched) {
      setModel(
        m === "transcribe" ? DEFAULT_LIVE_MODEL : DEFAULT_LIVE_TRANSLATE_MODEL,
      );
    }
  };

  const targetPanelRef = (lang: string): PanelData => {
    let p = targetsRef.current.get(lang);
    if (!p) {
      p = { lines: [], current: "" };
      targetsRef.current.set(lang, p);
    }
    return p;
  };

  const routeTargetLine = (raw: string, commit: boolean) => {
    const line = raw.trim();
    if (!line || line === "·") return;
    const targets = metaRef.current.targets;
    let lang = targets[0] ?? "Translation";
    let text = line;
    const m = /^\[([^\]]+)\]\s*(.*)$/.exec(line);
    if (m) {
      const tag = m[1].trim().toLowerCase();
      const found = targets.find(
        (t) => t.toLowerCase() === tag || t.toLowerCase().startsWith(tag),
      );
      if (found) {
        lang = found;
        text = m[2];
      }
    }
    if (!text) return;
    const panel = targetPanelRef(lang);
    if (commit) {
      panel.lines.push({ text, at: Date.now() - startTimeRef.current });
      panel.current = "";
    } else {
      panel.current = text;
    }
  };

  const drainTargetBuffer = (flush: boolean) => {
    const parts = targetBufRef.current.split("\n");
    const remainder = flush ? "" : (parts.pop() ?? "");
    for (const part of parts) routeTargetLine(part, true);
    targetBufRef.current = remainder;
    if (flush) {
      for (const p of targetsRef.current.values()) p.current = "";
    }
    if (remainder) routeTargetLine(remainder, false);
  };

  const commitAll = useCallback(() => {
    const cur = sourceRef.current.current.trim();
    if (cur) {
      sourceRef.current.lines.push({
        text: cur,
        at: Date.now() - startTimeRef.current,
      });
    }
    sourceRef.current.current = "";
    drainTargetBuffer(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    capRef.current?.stop();
    capRef.current = null;
    connRef.current?.close();
    connRef.current = null;
    setAnalyser(null);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(async () => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    setStage("saving");
    const usedModel = connRef.current?.model;
    cleanup();
    commitAll();
    syncPanels();

    const meta = metaRef.current;
    const liveTargets: Record<string, LiveLine[]> = {};
    for (const [lang, p] of targetsRef.current) {
      if (p.lines.length > 0) liveTargets[lang] = p.lines;
    }
    const record: SessionRecord = {
      id: uid(),
      kind: "live",
      title: `${MODE_META[meta.mode].label} session — ${new Date().toLocaleString(
        undefined,
        { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
      )}`,
      createdAt: startTimeRef.current || Date.now(),
      model: usedModel ?? model,
      mode: meta.mode,
      sourceLanguages: sourceLangs,
      targetLanguages: meta.mode === "transcribe" ? undefined : meta.targets,
      liveSource:
        sourceRef.current.lines.length > 0
          ? sourceRef.current.lines
          : undefined,
      liveTargets:
        Object.keys(liveTargets).length > 0 ? liveTargets : undefined,
      durationSec: startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : undefined,
    };
    const captured =
      (record.liveSource?.length ?? 0) > 0 ||
      Object.keys(record.liveTargets ?? {}).length > 0;
    if (captured) {
      await saveSession(record);
      router.push(`/session/${record.id}`);
    } else {
      setStage("setup");
      stoppedRef.current = false;
      setNotice("Nothing was captured — session discarded.");
    }
  }, [cleanup, commitAll, model, router, sourceLangs, syncPanels]);

  const start = async () => {
    setError(null);
    setNotice(null);
    setStage("connecting");
    stoppedRef.current = false;
    sourceRef.current = { lines: [], current: "" };
    targetsRef.current = new Map();
    targetBufRef.current = "";
    const meta = {
      mode,
      targets: mode === "transcribe" ? [] : [...targetLangs],
    };
    metaRef.current = meta;
    setSessionMeta(meta);
    syncPanels();

    try {
      const conn = await connectLive(
        {
          mode,
          model,
          sourceLanguages: sourceLangs,
          targetLanguages: meta.targets,
        },
        {
          onSourceDelta(text) {
            sourceRef.current.current += text;
            syncPanels();
          },
          onTargetDelta(text) {
            if (metaRef.current.mode === "transcribe") return;
            targetBufRef.current += text;
            drainTargetBuffer(false);
            syncPanels();
          },
          onCommit() {
            commitAll();
            syncPanels();
          },
          onOpen() {
            setNotice(null);
          },
          onError(message) {
            setError(message);
          },
          onClose(reason) {
            if (!stoppedRef.current && startTimeRef.current) {
              setNotice(
                reason
                  ? `Connection closed: ${reason}. Saving what was captured…`
                  : "Connection closed. Saving what was captured…",
              );
              void stop();
            }
          },
        },
      );
      connRef.current = conn;
      setActiveModel(conn.model);
      if (conn.insecure) {
        setNotice(
          "Dev mode: the raw API key was sent to the browser (GEMINI_ALLOW_BROWSER_KEY). Don't use this in production.",
        );
      }

      const cap = await startCapture(audioSource, (chunk) =>
        connRef.current?.sendChunk(chunk),
      );
      capRef.current = cap;
      setAnalyser(cap.analyser);

      startTimeRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(
        () =>
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
        1000,
      );
      setStage("live");
    } catch (e) {
      cleanup();
      startTimeRef.current = 0;
      setError(e instanceof Error ? e.message : String(e));
      setStage("setup");
    }
  };

  const needsTargets = mode !== "transcribe";
  const canStart = !needsTargets || targetLangs.length > 0;

  // ---------- render ----------

  if (stage === "live" || stage === "saving" || stage === "connecting") {
    const showSource = sessionMeta.mode !== "translate";
    const panelCount = (showSource ? 1 : 0) + sessionMeta.targets.length;
    return (
      <div className="space-y-4">
        {/* Status bar */}
        <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-rec">
            <span className="rec-dot inline-block h-2.5 w-2.5 rounded-full bg-rec" />
            {stage === "connecting"
              ? "CONNECTING"
              : stage === "saving"
                ? "SAVING"
                : "LIVE"}
          </span>
          <span className="font-mono text-sm tabular-nums">
            {fmtTime(elapsed)}
          </span>
          <LevelMeter analyser={analyser} />
          <span className="hidden items-center gap-1.5 text-xs text-ink-soft sm:flex">
            {audioSource === "mic" ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <MonitorSpeaker className="h-3.5 w-3.5" />
            )}
            {audioSource === "mic" ? "Microphone" : "Tab audio"}
          </span>
          <Badge tone="accent" className="hidden sm:inline-flex">
            {modelLabel(activeModel)}
          </Badge>
          <div className="ml-auto">
            <Button
              variant="danger"
              size="sm"
              busy={stage === "saving"}
              disabled={stage !== "live"}
              onClick={() => void stop()}
            >
              <Square className="h-3.5 w-3.5" />
              Stop &amp; save
            </Button>
          </div>
        </Card>

        {error && <ErrorNote>{error}</ErrorNote>}
        {notice && (
          <div className="rounded-xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-gold">
            {notice}
          </div>
        )}

        {/* Panels */}
        <div
          className={cn("flex flex-col gap-4", panelCount > 1 && "lg:flex-row")}
        >
          {showSource && (
            <LivePanel
              title={
                sourceLangs.length > 0
                  ? `Transcript · ${sourceLangs.join(", ")}`
                  : "Transcript"
              }
              data={sourcePanel}
            />
          )}
          {sessionMeta.mode !== "transcribe" &&
            sessionMeta.targets.map((lang) => (
              <LivePanel
                key={lang}
                title={lang}
                data={targetPanels[lang] ?? EMPTY_PANEL}
                accent
              />
            ))}
        </div>
      </div>
    );
  }

  // ---------- setup ----------
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Live session
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Stream from your microphone or a browser tab. Words appear as
          they&apos;re spoken.
        </p>
      </div>

      {/* Mode */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(MODE_META) as LiveMode[]).map((m) => {
          const meta = MODE_META[m];
          const Icon = meta.icon;
          const selected = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => changeMode(m)}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                selected
                  ? "border-accent bg-accent-soft/60 shadow-card"
                  : "border-line bg-card hover:border-accent/40",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  selected ? "text-accent" : "text-ink-soft",
                )}
              />
              <div className="mt-2 text-sm font-bold">{meta.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-ink-soft">
                {meta.description}
              </div>
            </button>
          );
        })}
      </div>

      <Card className="space-y-5 p-5">
        <LanguageMultiSelect
          label="Spoken languages"
          hint="optional — helps with mixed-language speech"
          value={sourceLangs}
          onChange={setSourceLangs}
        />
        {needsTargets && (
          <LanguageMultiSelect
            label="Translate into"
            hint="one panel per language"
            value={targetLangs}
            onChange={setTargetLangs}
          />
        )}

        {/* Audio source */}
        <div className="space-y-1.5">
          <span className="text-sm font-semibold">Audio source</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: "mic" as AudioSource,
                  icon: Mic,
                  label: "Microphone",
                  note: "In-room conversations, interviews, dictation",
                },
                {
                  id: "tab" as AudioSource,
                  icon: MonitorSpeaker,
                  label: "Browser tab",
                  note: "Meetings, webinars, videos playing in another tab",
                },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setAudioSource(s.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                  audioSource === s.id
                    ? "border-accent bg-accent-soft/60"
                    : "border-line bg-card hover:border-accent/40",
                )}
              >
                <s.icon
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    audioSource === s.id ? "text-accent" : "text-ink-soft",
                  )}
                />
                <span>
                  <span className="block text-sm font-semibold">{s.label}</span>
                  <span className="block text-xs text-ink-soft">{s.note}</span>
                </span>
              </button>
            ))}
          </div>
          {audioSource === "tab" && (
            <p className="text-xs text-gold">
              In the share dialog, pick a tab and enable &quot;Also share tab
              audio&quot;.
            </p>
          )}
        </div>

        <ModelPicker
          capability="live"
          value={model}
          onChange={(id) => {
            setModel(id);
            setModelTouched(true);
          }}
        />
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      {notice && (
        <div className="rounded-xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-gold">
          {notice}
        </div>
      )}

      <Button
        size="lg"
        className="w-full"
        disabled={!canStart}
        onClick={() => void start()}
      >
        <Play className="h-4 w-4" />
        Start {MODE_META[mode].label.toLowerCase()}
      </Button>
    </div>
  );
}
