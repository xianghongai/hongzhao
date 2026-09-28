import { useSyncExternalStore } from 'react';

import { type OtpEntry, entryKey } from '@/lib/otp/entries';

export interface StoredEntry extends OtpEntry {
  id: number;
}

/*
 * Entries live in module memory only: they survive switching tools,
 * and disappear when the tab closes or reloads. Nothing is written to storage.
 */

let entries: readonly StoredEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function commit(next: readonly StoredEntry[]): void {
  entries = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOtpEntries(): readonly StoredEntry[] {
  return useSyncExternalStore(subscribe, () => entries);
}

/** Adds new entries and skips ones already in the list; returns how many of each. */
export function addEntries(incoming: OtpEntry[]): { added: number; duplicates: number } {
  const seen = new Set(entries.map(entryKey));
  const fresh: StoredEntry[] = [];
  for (const entry of incoming) {
    const key = entryKey(entry);
    if (!seen.has(key)) {
      seen.add(key);
      fresh.push({ ...entry, id: nextId++ });
    }
  }
  commit([...entries, ...fresh]);
  return { added: fresh.length, duplicates: incoming.length - fresh.length };
}

export function renameEntry(id: number, label: string): void {
  commit(entries.map((entry) => (entry.id === id ? { ...entry, label } : entry)));
}

export function removeEntry(id: number): void {
  commit(entries.filter((entry) => entry.id !== id));
}

/** Removes every entry and returns them, so the caller can offer an undo. */
export function clearEntries(): readonly StoredEntry[] {
  const previous = entries;
  commit([]);
  return previous;
}

/** Puts cleared entries back in front of any added since, skipping duplicates. */
export function restoreEntries(previous: readonly StoredEntry[]): void {
  const keys = new Set(previous.map(entryKey));
  commit([...previous, ...entries.filter((entry) => !keys.has(entryKey(entry)))]);
}
