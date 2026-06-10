/** Shared types used across upload transcription, live sessions, and exports. */

export interface SpeakerInfo {
  id: string;
  /** Resolved human name when context documents allow it, e.g. "Priya (moderator)". */
  name?: string;
}

export interface Segment {
  speakerId: string;
  /** Start offset in seconds from the beginning of the media. */
  startSec?: number;
  endSec?: number;
  text: string;
  /** Language of this utterance (English name, e.g. "Hindi"). */
  language?: string;
}

export interface TranscriptResult {
  title: string;
  /** Languages detected in the audio, English names. */
  languages: string[];
  speakers: SpeakerInfo[];
  segments: Segment[];
}

export type LiveMode = "transcribe" | "translate" | "tandem";

export type AudioSource = "mic" | "tab";

/** One finalized line in a live panel. */
export interface LiveLine {
  text: string;
  /** ms since session start */
  at: number;
}

export interface SessionRecord {
  id: string;
  kind: "upload" | "live";
  title: string;
  createdAt: number;
  model: string;
  mode?: LiveMode;
  sourceLanguages: string[];
  targetLanguages?: string[];
  /** Upload sessions */
  transcript?: TranscriptResult;
  /** language name -> translated text per segment index */
  translations?: Record<string, string[]>;
  /** Live sessions */
  liveSource?: LiveLine[];
  /** language name -> lines */
  liveTargets?: Record<string, LiveLine[]>;
  durationSec?: number;
  mediaName?: string;
}

export interface TranscribeResponse {
  transcript: TranscriptResult;
  warnings?: string[];
}

export interface TranslateResponse {
  translations: string[];
}
