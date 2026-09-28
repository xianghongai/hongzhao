import { base32 } from '@scure/base';
import { describe, expect, it } from 'vitest';

import {
  type OtpEntry,
  generateCode,
  normalizeSecret,
  parseEntry,
  parseLine,
  parseScanned,
  splitLines,
  toUri,
} from '@/lib/otp/entries';

// RFC 6238, Appendix B: the seeds are ASCII strings, 20, 32 and 64 bytes long.
const seed = (length: number) => base32.encode(new TextEncoder().encode('1234567890'.repeat(7).slice(0, length)));

const rfcEntry = (algorithm: OtpEntry['algorithm'], length: number): OtpEntry => ({
  label: '',
  issuer: '',
  secret: seed(length).replace(/=+$/, ''),
  algorithm,
  digits: 8,
  period: 30,
});

describe('generateCode', () => {
  it.each([
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1111111111, '14050471', '67062674', '99943326'],
    [1234567890, '89005924', '91819424', '93441116'],
    [2000000000, '69279037', '90698825', '38618901'],
    [20000000000, '65353130', '77737706', '47863826'],
  ])('matches the RFC 6238 vectors at %i s', (seconds, sha1, sha256, sha512) => {
    const timestamp = seconds * 1000;
    expect(generateCode(rfcEntry('SHA1', 20), timestamp)).toBe(sha1);
    expect(generateCode(rfcEntry('SHA256', 32), timestamp)).toBe(sha256);
    expect(generateCode(rfcEntry('SHA512', 64), timestamp)).toBe(sha512);
  });
});

describe('normalizeSecret', () => {
  it('accepts grouped, lowercase and padded secrets', () => {
    expect(normalizeSecret('jbsw y3dp-ehpk 3pxp')).toBe('JBSWY3DPEHPK3PXP');
    expect(normalizeSecret('GEZDGNBV====')).toBe('GEZDGNBV');
  });

  it('rejects characters outside Base32 and impossible lengths', () => {
    expect(normalizeSecret('JBSW1')).toBeNull();
    expect(normalizeSecret('ABC')).toBeNull();
    expect(normalizeSecret('')).toBeNull();
  });
});

describe('parseLine', () => {
  it('reads a name before an ASCII or full-width comma', () => {
    expect(parseLine('GitHub, JBSWY3DPEHPK3PXP')).toMatchObject({ label: 'GitHub', secret: 'JBSWY3DPEHPK3PXP' });
    expect(parseLine('邮箱，jbsw y3dp ehpk 3pxp')).toMatchObject({ label: '邮箱', secret: 'JBSWY3DPEHPK3PXP' });
  });

  it('parses a TOTP key URI with its parameters', () => {
    const entry = parseLine(
      'otpauth://totp/ACME:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ACME&algorithm=SHA256&digits=8&period=60'
    );
    expect(entry).toEqual({
      label: 'alice@example.com',
      issuer: 'ACME',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA256',
      digits: 8,
      period: 60,
    });
  });

  it('explains what it does not support', () => {
    expect(parseLine('otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP&counter=1')).toEqual({ problem: 'hotp' });
    expect(parseLine('otpauth-migration://offline?data=abc')).toEqual({ problem: 'migration' });
    expect(parseLine('not a secret!')).toEqual({ problem: 'base32' });
  });
});

describe('parseScanned', () => {
  it('accepts key URIs only', () => {
    expect(parseScanned(' otpauth://totp/x?secret=JBSWY3DPEHPK3PXP ')).toMatchObject({ secret: 'JBSWY3DPEHPK3PXP' });
    expect(parseScanned('JBSWY3DPEHPK3PXP')).toEqual({ problem: 'notOtp' });
    expect(parseScanned('https://example.com')).toEqual({ problem: 'notOtp' });
    expect(parseScanned('otpauth-migration://offline?data=abc')).toEqual({ problem: 'migration' });
  });
});

describe('parseEntry', () => {
  it('reads a Base32 secret with the default settings', () => {
    expect(parseEntry({ name: ' GitHub ', secret: 'jbsw y3dp ehpk 3pxp' })).toEqual({
      label: 'GitHub',
      issuer: '',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
  });

  it('lets a typed name override the account in a key URI', () => {
    const uri = 'otpauth://totp/ACME:alice?secret=JBSWY3DPEHPK3PXP&issuer=ACME';
    expect(parseEntry({ name: '', secret: uri })).toMatchObject({ label: 'alice', issuer: 'ACME' });
    expect(parseEntry({ name: '工作邮箱', secret: uri })).toMatchObject({ label: '工作邮箱', issuer: 'ACME' });
  });

  it('asks for a missing secret', () => {
    expect(parseEntry({ name: 'GitHub', secret: '  ' })).toEqual({ problem: 'emptySecret' });
  });
});

describe('splitLines', () => {
  it('splits pasted lines into rows and keeps key URIs whole', () => {
    const uri = 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&issuer=A,B';
    expect(splitLines(`JBSWY3DPEHPK3PXP\n\n邮箱，GEZDGNBV\n${uri}`)).toEqual([
      { name: '', secret: 'JBSWY3DPEHPK3PXP' },
      { name: '邮箱', secret: 'GEZDGNBV' },
      { name: '', secret: uri },
    ]);
  });
});

describe('toUri', () => {
  it('round-trips through parseLine', () => {
    const entry: OtpEntry = {
      label: 'alice',
      issuer: 'ACME Co',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    };
    expect(parseLine(toUri(entry))).toEqual(entry);
  });
});
