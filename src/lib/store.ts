/** Local-first persistence: sessions live in the browser's IndexedDB. */

import { openDB, type IDBPDatabase } from "idb";
import type { SessionRecord } from "./types";

const DB_NAME = "convo";
const STORE = "sessions";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    throw new Error("Session store is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore(STORE, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function saveSession(s: SessionRecord): Promise<void> {
  await (await db()).put(STORE, s);
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
  return (await db()).get(STORE, id);
}

export async function listSessions(): Promise<SessionRecord[]> {
  const all: SessionRecord[] = await (await db()).getAll(STORE);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSession(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}
