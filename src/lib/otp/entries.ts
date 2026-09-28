import { HOTP, Secret, TOTP, URI } from 'otpauth';

export const ALGORITHMS = ['SHA1', 'SHA256', 'SHA512'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

export interface OtpSettings {
  algorithm: Algorithm;
  digits: number;
  period: number;
}

export const DEFAULT_SETTINGS: OtpSettings = { algorithm: 'SHA1', digits: 6, period: 30 };

export interface OtpEntry extends OtpSettings {
  label: string;
  issuer: string;
  /** Normalized Base32, uppercase, without spaces or padding. */
  secret: string;
}

/** A name and a secret as typed into one row, before validation. */
export interface NamedSecret {
  name: string;
  secret: string;
}

function isAlgorithm(value: string): value is Algorithm {
  return (ALGORITHMS as readonly string[]).includes(value);
}

/**
 * Normalizes a Base32 secret the way people paste it: grouped with spaces or hyphens,
 * lowercase, with or without `=` padding. Returns null when it is not Base32.
 */
export function normalizeSecret(raw: string): string | null {
  const secret = raw.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();
  if (secret === '' || !/^[A-Z2-7]+$/.test(secret)) {
    return null;
  }
  // 1, 3 and 6 trailing characters cannot come from whole bytes.
  if ([1, 3, 6].includes(secret.length % 8)) {
    return null;
  }
  return secret;
}

/** Why a secret or scanned code could not be added; the interface puts it into words. */
export type OtpProblem =
  | { problem: 'uriInvalid' }
  | { problem: 'hotp' }
  | { problem: 'algorithm'; algorithm: string }
  | { problem: 'emptySecret' }
  | { problem: 'migration' }
  | { problem: 'base32' }
  | { problem: 'notOtp' };

export type ParseResult = OtpEntry | OtpProblem;

export function isProblem(result: ParseResult): result is OtpProblem {
  return 'problem' in result;
}

function parseUri(input: string): ParseResult {
  let otp: HOTP | TOTP;
  try {
    otp = URI.parse(input);
  } catch {
    return { problem: 'uriInvalid' };
  }
  if (!(otp instanceof TOTP)) {
    return { problem: 'hotp' };
  }
  if (!isAlgorithm(otp.algorithm)) {
    return { problem: 'algorithm', algorithm: otp.algorithm };
  }
  return {
    label: otp.label,
    issuer: otp.issuer,
    secret: otp.secret.base32.replace(/=+$/, ''),
    algorithm: otp.algorithm,
    digits: otp.digits,
    period: otp.period,
  };
}

const KEY_URI = /^otpauth(-migration)?:/i;

/**
 * Parses a name and a secret. The secret is a Base32 key or an `otpauth://` URI;
 * a non-empty name overrides the account name a URI carries.
 */
export function parseEntry({ name, secret }: NamedSecret, settings: OtpSettings = DEFAULT_SETTINGS): ParseResult {
  const value = secret.trim();
  const label = name.trim();
  if (value === '') {
    return { problem: 'emptySecret' };
  }
  if (/^otpauth-migration:/i.test(value)) {
    return { problem: 'migration' };
  }
  if (/^otpauth:/i.test(value)) {
    const parsed = parseUri(value);
    return isProblem(parsed) || label === '' ? parsed : { ...parsed, label };
  }
  const normalized = normalizeSecret(value);
  if (normalized === null) {
    return { problem: 'base32' };
  }
  return { label, issuer: '', secret: normalized, ...settings };
}

/**
 * Splits one pasted line into a name and a secret: `name, secret` with an ASCII or full-width comma,
 * which Base32 never contains. A key URI is taken whole, since its query may contain commas.
 */
export function splitLine(line: string): NamedSecret {
  const text = line.trim();
  if (KEY_URI.test(text)) {
    return { name: '', secret: text };
  }
  const comma = Math.max(text.lastIndexOf(','), text.lastIndexOf('，'));
  return comma === -1
    ? { name: '', secret: text }
    : { name: text.slice(0, comma).trim(), secret: text.slice(comma + 1).trim() };
}

/** Splits pasted text into rows, skipping blank lines. */
export function splitLines(text: string): NamedSecret[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map(splitLine);
}

/** Parses one line of text: see {@link splitLine} and {@link parseEntry}. */
export function parseLine(input: string, settings: OtpSettings = DEFAULT_SETTINGS): ParseResult {
  return parseEntry(splitLine(input), settings);
}

/**
 * Parses the content of a scanned QR code. Setup codes always carry a key URI,
 * so anything else is reported as not a 2FA code rather than as a bad Base32 secret.
 */
export function parseScanned(text: string): ParseResult {
  const content = text.trim();
  if (!KEY_URI.test(content)) {
    return { problem: 'notOtp' };
  }
  return parseLine(content);
}

function toTotp(entry: OtpEntry): TOTP {
  return new TOTP({
    issuer: entry.issuer,
    // Authenticator apps need a non-empty label to list the account.
    label: entry.label === '' ? 'Account' : entry.label,
    issuerInLabel: entry.issuer !== '',
    secret: Secret.fromBase32(entry.secret),
    algorithm: entry.algorithm,
    digits: entry.digits,
    period: entry.period,
  });
}

export function generateCode(entry: OtpEntry, timestamp: number = Date.now()): string {
  return TOTP.generate({
    secret: Secret.fromBase32(entry.secret),
    algorithm: entry.algorithm,
    digits: entry.digits,
    period: entry.period,
    timestamp,
  });
}

/** Milliseconds elapsed in the current period. */
export function elapsedInPeriod(entry: OtpEntry, timestamp: number = Date.now()): number {
  return timestamp % (entry.period * 1000);
}

/** A key URI that authenticator apps import by scanning. */
export function toUri(entry: OtpEntry): string {
  return URI.stringify(toTotp(entry));
}

/** The same account shows up once: identical secret and parameters. */
export function entryKey(entry: OtpEntry): string {
  return [entry.secret, entry.algorithm, entry.digits, entry.period].join(':');
}
