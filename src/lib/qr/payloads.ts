/**
 * Builders for the de facto QR payload formats that phone scanners recognise.
 * Each builder is pure and returns the exact text to encode.
 */

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface WifiInput {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

/** Escapes the characters that the `WIFI:` format reserves. */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

export function wifiPayload({ ssid, password, security, hidden }: WifiInput): string {
  const parts = [`T:${security}`, `S:${escapeWifi(ssid)}`];
  if (security !== 'nopass') {
    parts.push(`P:${escapeWifi(password)}`);
  }
  if (hidden) {
    parts.push('H:true');
  }
  return `WIFI:${parts.join(';')};;`;
}

/** Escapes a text value for vCard 3.0 and iCalendar (RFC 2426, RFC 5545). */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function contentLines(lines: Array<[name: string, value: string]>): string[] {
  return lines.filter(([, value]) => value.trim() !== '').map(([name, value]) => `${name}:${value}`);
}

export interface ContactInput {
  name: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  url: string;
  address: string;
  note: string;
}

export function vcardPayload(input: ContactInput): string {
  const name = escapeText(input.name.trim());
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    // `N` is required by vCard 3.0; the full name goes into the family-name slot, which keeps CJK names intact.
    `N:${name};;;;`,
    `FN:${name}`,
    ...contentLines([
      ['ORG', escapeText(input.org.trim())],
      ['TITLE', escapeText(input.title.trim())],
      ['TEL;TYPE=CELL', input.phone.trim()],
      ['EMAIL', input.email.trim()],
      ['URL', input.url.trim()],
      ['ADR', input.address.trim() === '' ? '' : `;;${escapeText(input.address.trim())};;;;`],
      ['NOTE', escapeText(input.note.trim())],
    ]),
    'END:VCARD',
  ].join('\r\n');
}

export interface EmailInput {
  to: string;
  subject: string;
  body: string;
}

export function emailPayload({ to, subject, body }: EmailInput): string {
  const query = new URLSearchParams();
  if (subject !== '') {
    query.set('subject', subject);
  }
  if (body !== '') {
    query.set('body', body);
  }
  // mailto expects %20 for spaces, not the `+` that URLSearchParams writes.
  const search = query.toString().replace(/\+/g, '%20');
  return `mailto:${to.trim()}${search === '' ? '' : `?${search}`}`;
}

export interface SmsInput {
  phone: string;
  message: string;
}

export function smsPayload({ phone, message }: SmsInput): string {
  return `SMSTO:${phone.trim()}:${message}`;
}

export function telPayload(phone: string): string {
  return `tel:${phone.replace(/[\s()-]/g, '')}`;
}

export interface GeoInput {
  latitude: string;
  longitude: string;
  label: string;
}

export function geoPayload({ latitude, longitude, label }: GeoInput): string {
  const base = `geo:${latitude.trim()},${longitude.trim()}`;
  return label.trim() === '' ? base : `${base}?q=${encodeURIComponent(label.trim())}`;
}

export function isValidCoordinate(value: string, limit: number): boolean {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) {
    return false;
  }
  return Math.abs(Number(value)) <= limit;
}

export interface EventInput {
  title: string;
  /** `YYYY-MM-DDTHH:mm`, as an `<input type="datetime-local">` gives it; kept as floating local time. */
  start: string;
  end: string;
  location: string;
  description: string;
}

/** Converts `YYYY-MM-DDTHH:mm[:ss]` to the iCalendar form `YYYYMMDDTHHmmss`. */
function icsDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    return '';
  }
  const [, y, mo, d, h, mi, s = '00'] = match;
  return `${y}${mo}${d}T${h}${mi}${s}`;
}

export function eventPayload(input: EventInput): string {
  return [
    'BEGIN:VEVENT',
    ...contentLines([
      ['SUMMARY', escapeText(input.title.trim())],
      ['DTSTART', icsDateTime(input.start)],
      ['DTEND', icsDateTime(input.end)],
      ['LOCATION', escapeText(input.location.trim())],
      ['DESCRIPTION', escapeText(input.description.trim())],
    ]),
    'END:VEVENT',
  ].join('\r\n');
}
