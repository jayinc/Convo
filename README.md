# Convo

Context-aware transcription and one-click translation — for files **and** live
audio. Think Plaud/Granola, plus simultaneous translation.

## What it does

**Upload & transcribe**

- Drop in audio **or video** — video files have their audio track stripped in
  the browser (no ffmpeg, no server round-trip) before upload.
- Attach **context documents in any format** (PDF, DOCX, TXT/MD/CSV, even
  images of an interview guide). They ground the transcription: domain terms
  get spelled correctly, mixed-language passages are handled properly, and
  **speakers are labeled with real names** when the context reveals them.
- Diarized, timestamped transcript with per-segment language labels.
- **One-click translation** into 45+ languages, rendered side-by-side with the
  original.
- Export to **PDF, DOCX, TXT, SRT, VTT**.

**Live sessions**

- Three modes: **Transcription**, **Translation**, and **Tandem** (transcript
  and translation streaming side-by-side).
- Choose multiple source languages and multiple target languages — one panel
  per target.
- Audio from the **microphone** or **any browser tab** (meetings, webinars,
  videos).
- Sessions are saved locally and exportable like any transcript.

**Model picker**

A provider-agnostic registry (`src/lib/models.ts`) backs the model picker.
Gemini is fully wired (`gemini-3.5-flash` default for files,
`gemini-3.1-flash-live-preview` / `gemini-3.5-live-translate-preview` for
live); OpenAI / Deepgram / Claude slots are declared and ready for adapters.

## Getting started

```bash
cp .env.example .env.local   # add your GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Get a Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Architecture

```
src/
├── app/
│   ├── page.tsx              landing + recent sessions
│   ├── upload/               file transcription workflow
│   ├── live/                 real-time session (mic / tab audio)
│   ├── session/[id]/         saved session viewer
│   └── api/
│       ├── transcribe/       Gemini multimodal transcription (structured JSON)
│       ├── translate/        segment-aligned translation
│       └── live-token/       mints ephemeral Live API tokens
├── components/               UI kit + feature components
└── lib/
    ├── models.ts             provider-agnostic model registry
    ├── audio/                WAV encode, video→audio extraction, worklet capture
    ├── live/client.ts        browser↔Gemini Live websocket wrapper
    ├── export/               TXT/SRT/VTT, DOCX, print-quality PDF
    └── server/               Gemini client, context-doc ingestion, prompts
```

Key design decisions:

- **Local-first**: transcripts live in the browser (IndexedDB). No accounts,
  no server-side storage. The only secret is the Gemini key in `.env.local`.
- **Ephemeral tokens for live audio**: the browser connects straight to the
  Gemini Live API websocket using a single-use token minted by
  `/api/live-token` — low latency, and the real API key never leaves the
  server.
- **Client-side audio extraction**: `OfflineAudioContext` decodes video
  containers and re-encodes 16 kHz mono WAV, so only audio crosses the wire.
- **Print-engine PDFs**: PDF export uses the browser's text shaping, which
  renders every script (Devanagari, CJK, Arabic, …) without bundling fonts.

## Notes & limits

- Live capture requires a Chromium-based browser for tab-audio sharing
  (`getDisplayMedia` with audio). Microphone capture works in all modern
  browsers.
- Media >15 MB is routed through the Gemini Files API (resumable upload,
  up to ~2 GB).
- If ephemeral-token minting is unavailable in your environment, set
  `GEMINI_ALLOW_BROWSER_KEY=true` in `.env.local` (development only) to fall
  back to direct key usage for live sessions.
