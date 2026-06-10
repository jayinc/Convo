import type { Metadata } from "next";
import Link from "next/link";
import { AudioLines, MicVocal, Upload } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Convo — transcribe & translate anything",
  description:
    "Context-aware transcription with speaker names, one-click translation, and real-time multilingual sessions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-white">
                <AudioLines className="h-4 w-4" />
              </span>
              <span className="font-display text-xl font-bold tracking-tight">
                convo<span className="text-accent">.</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/upload"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-ink-soft transition hover:bg-paper-2 hover:text-ink"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Transcribe a file</span>
              </Link>
              <Link
                href="/live"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-ink-soft transition hover:bg-paper-2 hover:text-ink"
              >
                <MicVocal className="h-4 w-4" />
                <span className="hidden sm:inline">Live session</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-line py-6 text-center text-xs text-ink-soft">
          Convo — local-first transcription &amp; translation. Your sessions
          stay in this browser.
        </footer>
      </body>
    </html>
  );
}
