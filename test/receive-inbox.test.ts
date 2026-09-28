import { describe, expect, it } from 'vitest';

import {
  encodeEncrypted,
  encodePlain,
  encodeSealedFor,
  generateKey,
  generateKeyPair,
  isKey,
} from '@/lib/share/envelope';
import { hashParams, publicKeyFrom, publicKeyLink, receiveUrl } from '@/lib/share/link';
import { maskKey } from '@/lib/share/mask';
import { classify } from '@/receive/inbox';

describe('isKey', () => {
  it('accepts generated keys and rejects anything else', () => {
    expect(isKey(generateKey())).toBe(true);
    expect(isKey(` ${generateKey()} `)).toBe(true);
    expect(isKey('short')).toBe(false);
    expect(isKey(encodePlain('hi'))).toBe(false);
  });
});

describe('classify', () => {
  it('recognises a key', () => {
    const key = generateKey();
    expect(classify(key)).toEqual({ kind: 'key', key });
  });

  it('reads envelopes from full links and bare envelopes', () => {
    const plain = encodePlain('你好');
    expect(classify(receiveUrl(plain, 'https://example.github.io/tools/'))).toMatchObject({
      kind: 'envelope',
      envelope: plain,
      parsed: { encrypted: false, text: '你好' },
    });
    const sealed = encodeEncrypted('secret', generateKey());
    expect(classify(sealed)).toMatchObject({ kind: 'envelope', envelope: sealed, parsed: { encrypted: true } });
  });

  it('reports other content and broken envelopes', () => {
    expect(classify('https://example.com')).toMatchObject({ kind: 'invalid', error: { reason: 'foreign' } });
    expect(classify('WIFI:T:WPA;S:x;;')).toMatchObject({ kind: 'invalid' });
    expect(classify('x.AA')).toMatchObject({ kind: 'invalid', error: { reason: 'foreign' } });
    expect(classify('alg=RSA-OAEP&data=AA')).toMatchObject({
      kind: 'invalid',
      error: { reason: 'unsupportedAlg', detail: { alg: 'RSA-OAEP' } },
    });
  });
});

describe('maskKey', () => {
  it('keeps four characters at each end and a fixed run of asterisks', () => {
    expect(maskKey('4oDE_sO0wGHUr5ZfzxnZXlG8OLbSIYz-rVMpVOZ_9LU0')).toBe('4oDE********9LU0');
    expect(maskKey('short')).toBe('********');
  });
});

describe('classify with public keys', () => {
  it('reads a public-key envelope, and takes a bare X25519 key for a random key', () => {
    const { publicKey } = generateKeyPair();
    expect(classify(encodeSealedFor('hi', publicKey))).toMatchObject({
      kind: 'envelope',
      parsed: { encrypted: true, scheme: 'public' },
    });
    // Keys carry no marker; the offerKey rule on the page then rejects it as a mismatch.
    expect(classify(publicKey)).toEqual({ kind: 'key', key: publicKey });
  });
});

describe('public-key links', () => {
  it('puts the key in a fragment parameter and reads it back', () => {
    const { publicKey } = generateKeyPair();
    const link = publicKeyLink(publicKey, 'https://example.github.io/tools/');
    expect(link).toBe(`https://example.github.io/tools/#/share?public_key=${publicKey}`);
    expect(hashParams(new URL(link).hash).get('public_key')).toBe(publicKey);
    expect(publicKeyFrom(link)).toBe(publicKey);
    expect(publicKeyFrom(` ${publicKey} `)).toBe(publicKey);
  });
});
