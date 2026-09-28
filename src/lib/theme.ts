import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

/*
 * The theme lives on <html class="dark">, which the pages ship with.
 * The choice is not persisted: the site keeps nothing in the browser, not even preferences.
 */

const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current);
}
