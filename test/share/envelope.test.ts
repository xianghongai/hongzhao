import { base64urlnopad } from '@scure/base';
import { describe, expect, it } from 'vitest';

import {
  EnvelopeError,
  decrypt,
  decryptWithPrivateKey,
  encodeEncrypted,
  encodePlain,
  encodeSealedFor,
  exportPrivateKey,
  generateKey,
  generateKeyPair,
  importPrivateKey,
  isKey,
  looksLikeEnvelope,
  parseEnvelope,
} from '@/lib/share/envelope';

const samples = ['', 'hello', '订阅地址：https://example.com/sub?token=abc&x=1', '🙂'.repeat(50), 'a'.repeat(5000)];

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof EnvelopeError ? error.code : 'other';
  }
  return undefined;
}

/** Flips the last bit of `data`, which is inside the authentication tag. */
function tamper(envelope: string): Uint8Array {
  const parsed = parseEnvelope(envelope);
  if (!parsed.encrypted) {
    throw new Error('expected an encrypted envelope');
  }
  const data = parsed.data.slice();
  data[data.length - 1]! ^= 1;
  return data;
}

describe('plain envelopes', () => {
  it.each(samples)('round-trips %#', (text) => {
    const envelope = encodePlain(text);
    expect(envelope).toMatch(/^data=[A-Za-z0-9_-]+$/);
    expect(parseEnvelope(envelope)).toEqual({ encrypted: false, text });
  });

  it('compresses repetitive text', () => {
    expect(encodePlain('a'.repeat(5000)).length).toBeLessThan(100);
  });
});

describe('random-key envelopes', () => {
  it.each(samples)('round-trips %#', (text) => {
    const key = generateKey();
    const envelope = encodeEncrypted(text, key);
    expect(envelope).toMatch(/^alg=A256GCM&data=[A-Za-z0-9_-]+$/);
    const parsed = parseEnvelope(envelope);
    expect(parsed).toMatchObject({ encrypted: true, scheme: 'key' });
    expect(parsed.encrypted && decrypt(parsed.data, key)).toBe(text);
  });

  it('generates 256-bit keys and a fresh nonce each time', () => {
    const key = generateKey();
    expect(key).toHaveLength(43);
    expect(base64urlnopad.decode(key)).toHaveLength(32);
    expect(encodeEncrypted('same', key)).not.toBe(encodeEncrypted('same', key));
  });

  it('rejects a wrong key, tampering and malformed keys', () => {
    const key = generateKey();
    const envelope = encodeEncrypted('secret', key);
    const parsed = parseEnvelope(envelope);
    expect(parsed.encrypted && codeOf(() => decrypt(parsed.data, generateKey()))).toBe('decrypt');
    expect(codeOf(() => decrypt(tamper(envelope), key))).toBe('decrypt');
    expect(parsed.encrypted && codeOf(() => decrypt(parsed.data, 'short'))).toBe('key');
  });
});

describe('public-key envelopes', () => {
  it.each(samples)('round-trips %#', (text) => {
    const { publicKey, privateKey } = generateKeyPair();
    const envelope = encodeSealedFor(text, publicKey);
    expect(envelope).toMatch(/^alg=ECDH-ES&data=[A-Za-z0-9_-]+$/);
    const parsed = parseEnvelope(envelope);
    expect(parsed).toMatchObject({ encrypted: true, scheme: 'public' });
    expect(parsed.encrypted && decryptWithPrivateKey(parsed.data, privateKey)).toBe(text);
  });

  it('uses a fresh ephemeral key for every message', () => {
    const { publicKey } = generateKeyPair();
    expect(encodeSealedFor('same', publicKey)).not.toBe(encodeSealedFor('same', publicKey));
  });

  it('opens with no other private key, and not after tampering', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const envelope = encodeSealedFor('secret', publicKey);
    const parsed = parseEnvelope(envelope);
    expect(parsed.encrypted && codeOf(() => decryptWithPrivateKey(parsed.data, generateKeyPair().privateKey))).toBe(
      'decrypt'
    );
    expect(codeOf(() => decryptWithPrivateKey(tamper(envelope), privateKey))).toBe('decrypt');
  });

  it('writes keys as plain Base64URL without markers', () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(exportPrivateKey(privateKey)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isKey(publicKey)).toBe(true);
  });

  it('restores a key pair from a backed-up private key', () => {
    const original = generateKeyPair();
    const restored = importPrivateKey(exportPrivateKey(original.privateKey));
    expect(restored.publicKey).toBe(original.publicKey);
    const parsed = parseEnvelope(encodeSealedFor('after a reload', original.publicKey));
    expect(parsed.encrypted && decryptWithPrivateKey(parsed.data, restored.privateKey)).toBe('after a reload');
    expect(codeOf(() => importPrivateKey('not a key'))).toBe('key');
  });
});

describe('algorithm binding', () => {
  it('rejects data relabelled with another alg', () => {
    const relabelled = encodeEncrypted('secret', generateKey()).replace('alg=A256GCM', 'alg=ECDH-ES');
    const parsed = parseEnvelope(relabelled);
    expect(parsed).toMatchObject({ scheme: 'public' });
    // Whether it fails on length or on authentication, relabelled bytes never open.
    expect(
      parsed.encrypted && codeOf(() => decryptWithPrivateKey(parsed.data, generateKeyPair().privateKey))
    ).toBeDefined();
  });
});

describe('parseEnvelope', () => {
  it('reports truncated, unknown and malformed envelopes', () => {
    expect(codeOf(() => parseEnvelope('alg=A256GCM'))).toBe('format');
    expect(codeOf(() => parseEnvelope('data='))).toBe('format');
    expect(codeOf(() => parseEnvelope('alg=RSA-OAEP&data=AA'))).toBe('format');
    expect(codeOf(() => parseEnvelope('data=!!'))).toBe('format');
  });

  it('recognises envelopes by their data parameter', () => {
    expect(looksLikeEnvelope('data=AA')).toBe(true);
    expect(looksLikeEnvelope('alg=A256GCM&data=AA')).toBe(true);
    expect(looksLikeEnvelope('metadata=AA')).toBe(false);
    expect(looksLikeEnvelope('https://example.com')).toBe(false);
  });
});
