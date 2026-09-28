import { EnvelopeError, type ParsedEnvelope, isKey, looksLikeEnvelope, parseEnvelope } from '@/lib/share/envelope';
import { envelopeFrom } from '@/receive/take-fragment';

export type Received =
  | { kind: 'key'; key: string }
  | { kind: 'envelope'; envelope: string; parsed: ParsedEnvelope }
  | { kind: 'invalid'; error: EnvelopeError };

/**
 * Sorts what arrived, whether scanned, pasted or opened as a link:
 * a key to remember, an envelope to open, or something this page cannot use.
 */
export function classify(input: string): Received {
  const text = input.trim();
  if (isKey(text)) {
    return { kind: 'key', key: text };
  }
  const envelope = envelopeFrom(text);
  // Every envelope carries a `data` parameter; anything else is some other QR code or text.
  if (!looksLikeEnvelope(envelope)) {
    return { kind: 'invalid', error: new EnvelopeError('format', 'foreign') };
  }
  try {
    return { kind: 'envelope', envelope, parsed: parseEnvelope(envelope) };
  } catch (error) {
    return {
      kind: 'invalid',
      error: error instanceof EnvelopeError ? error : new EnvelopeError('format', 'unreadable'),
    };
  }
}
