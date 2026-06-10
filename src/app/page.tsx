import Link from "next/link";
import {
  ArrowRight,
  FileAudio,
  Globe2,
  MicVocal,
  ScrollText,
  SplitSquareHorizontal,
  Users,
} from "lucide-react";
import { RecentSessions } from "@/components/RecentSessions";

export default function Home() {
  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="pt-6 text-center sm:pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Transcription · Translation · Real-time
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Every word, in every language you need it in.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-soft sm:text-lg">
          Convo turns recordings and live conversations into accurate,
          speaker-labeled transcripts — grounded by your own documents — and
          translates them with one click.
        </p>
      </section>

      {/* Mode cards */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/upload"
          className="group rounded-3xl border border-line bg-card p-7 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
        >
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <FileAudio className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-ink-soft transition group-hover:translate-x-1 group-hover:text-accent" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold">
            Transcribe a file
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Drop in audio or video — we strip the audio track in your browser.
            Attach interview guides or notes so names, jargon, and
            mixed-language speech come out right.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
            <li className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> Speaker labels — with
              real names when context allows
            </li>
            <li className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-accent" /> One-click translation
              into 45+ languages
            </li>
            <li className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-accent" /> Export PDF, DOCX,
              TXT, SRT, VTT
            </li>
          </ul>
        </Link>

        <Link
          href="/live"
          className="group rounded-3xl border border-line bg-card p-7 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
        >
          <div className="flex items-center justify-between">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-soft text-gold">
              <MicVocal className="h-6 w-6" />
            </span>
            <ArrowRight className="h-5 w-5 text-ink-soft transition group-hover:translate-x-1 group-hover:text-accent" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold">Go live</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Capture your microphone or any browser tab and watch words stream
            in as they&apos;re spoken — transcribed, translated, or both at
            once.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
            <li className="flex items-center gap-2">
              <SplitSquareHorizontal className="h-4 w-4 text-gold" /> Tandem
              mode: source &amp; translation side-by-side
            </li>
            <li className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-gold" /> Multiple source and
              target languages per session
            </li>
            <li className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-gold" /> Sessions saved
              locally, exportable like any transcript
            </li>
          </ul>
        </Link>
      </section>

      {/* Recent sessions */}
      <section id="sessions" className="space-y-4">
        <h2 className="font-display text-2xl font-bold">Your sessions</h2>
        <RecentSessions />
      </section>
    </div>
  );
}
