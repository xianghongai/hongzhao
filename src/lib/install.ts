import { useSyncExternalStore } from 'react';

/** Chromium's install prompt; not in the TypeScript DOM library. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/*
 * The browser fires `beforeinstallprompt` once, possibly before React renders,
 * so the listener is attached when this module loads and the event is kept for later.
 */

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferred = event as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the browser offers installation right now (Chromium-based browsers only). */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, () => deferred !== null);
}

export async function install(): Promise<void> {
  const event = deferred;
  if (!event) {
    return;
  }
  await event.prompt();
  await event.userChoice;
  // The event can only be used once.
  deferred = null;
  notify();
}
