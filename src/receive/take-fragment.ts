/**
 * Reads the envelope from the fragment and removes it from the address bar and the current history entry,
 * so a reload, a bookmark or a shared screen does not carry the content along.
 */
export function takeFragment(): string {
  const fragment = window.location.hash.slice(1);
  if (fragment !== '') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  // Some apps percent-encode the fragment when they pass a link on; the envelope alphabet never needs it.
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/** Accepts a full receive link or a bare envelope, as pasted by hand. */
export function envelopeFrom(input: string): string {
  const text = input.trim();
  const hash = text.indexOf('#');
  return hash === -1 ? text : text.slice(hash + 1);
}
