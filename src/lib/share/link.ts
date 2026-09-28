/**
 * Receive links look like `<base>r/#<envelope>`. The envelope stays in the fragment,
 * which browsers never send to the server.
 *
 * `r/` is a public contract like the envelope format: links already sent must keep working.
 * When the site moves to a custom domain, GitHub Pages redirects the old address and keeps the path,
 * and browsers carry the fragment across the redirect.
 */

export const RECEIVE_PATH = 'r/';

/**
 * The length budget reserved for `<base>r/#`, whatever the current address is.
 * Capacity checks use at least this much, so content that fits today still fits
 * after the site moves to any base up to this length.
 */
export const RESERVED_PREFIX_LENGTH = 80;

/**
 * The site root the links point to: `VITE_SHARE_BASE` when set at build time,
 * otherwise the directory of the page that runs the tool (GitHub Pages, a LAN address or localhost).
 */
export function siteBase(location: Pick<Location, 'href'> = window.location): string {
  const configured: unknown = import.meta.env.VITE_SHARE_BASE;
  if (typeof configured === 'string' && configured !== '') {
    return configured.endsWith('/') ? configured : `${configured}/`;
  }
  let url = new URL('.', location.href);
  // The receive page lives one level down, in `r/`; the site root is its parent.
  if (url.pathname.endsWith(`/${RECEIVE_PATH}`)) {
    url = new URL('..', url);
  }
  url.search = '';
  url.hash = '';
  return url.href;
}

export function receiveUrl(envelope: string, base: string = siteBase()): string {
  return `${base}${RECEIVE_PATH}#${envelope}`;
}

/**
 * The longest receive link the share tool makes. Chrome opens URLs up to 2 MB but shows at most 32 KB of one in the
 * address bar, and Firefox about 64 KB; past this, links also get cut short by the apps that carry them.
 */
export const MAX_LINK_LENGTH = 32_768;

/** The length a receive link will count against capacity limits, including the reserved prefix. */
export function budgetedLength(envelope: string, base: string = siteBase()): number {
  const prefix = base.length + RECEIVE_PATH.length + 1;
  return Math.max(prefix, RESERVED_PREFIX_LENGTH) + envelope.length;
}

/** A link that points at this machine (localhost) opens nothing on another device. */
export function isLoopback(base: string): boolean {
  const host = new URL(base).hostname;
  return host === 'localhost' || host === '[::1]' || host.startsWith('127.');
}

/** The route and parameter that open the share tool ready to encrypt to someone's public key. */
const SHARE_ROUTE = '#/share';
const PUBLIC_KEY_PARAM = 'public_key';

/**
 * A link that opens the share tool with the recipient's public key filled in. The key sits in the fragment,
 * so it never reaches a server; `public_key` is part of the public contract, as QR codes carry it.
 */
export function publicKeyLink(publicKey: string, base: string = siteBase()): string {
  return `${base}${SHARE_ROUTE}?${PUBLIC_KEY_PARAM}=${publicKey}`;
}

/** Parameters after `?` inside the fragment, as in `#/share?public_key=…`. */
export function hashParams(hash: string = window.location.hash): URLSearchParams {
  const query = hash.indexOf('?');
  return new URLSearchParams(query === -1 ? '' : hash.slice(query + 1));
}

/** Reads a public key from what was scanned or pasted: the bare key, or a public-key link. */
export function publicKeyFrom(text: string): string {
  const value = text.trim();
  const hash = value.indexOf('#');
  return hash === -1 ? value : (hashParams(value.slice(hash)).get(PUBLIC_KEY_PARAM) ?? value);
}
