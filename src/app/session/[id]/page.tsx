"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { LiveSessionView } from "@/components/LiveSessionView";
import { TranscriptWorkspace } from "@/components/TranscriptWorkspace";
import { deleteSession, getSession, saveSession } from "@/lib/store";
import type { SessionRecord } from "@/lib/types";

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionRecord | null | undefined>(
    undefined,
  );

  useEffect(() => {
    void getSession(id)
      .then((s) => setSession(s ?? null))
      .catch(() => setSession(null));
  }, [id]);

  if (session === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Loading session…" />
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Session not found</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sessions are stored per-browser — this one may have been created
          elsewhere or deleted.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" /> All sessions
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Delete this session? This cannot be undone.")) {
              void deleteSession(session.id).then(() => router.push("/"));
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {session.kind === "upload" ? (
        <TranscriptWorkspace
          session={session}
          onChange={(s) => {
            setSession(s);
            void saveSession(s);
          }}
        />
      ) : (
        <LiveSessionView session={session} />
      )}
    </div>
  );
}
