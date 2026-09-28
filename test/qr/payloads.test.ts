import { describe, expect, it } from 'vitest';

import { encodeQr, fitsBytes, modulesToPath } from '@/lib/qr/encode';
import {
  emailPayload,
  eventPayload,
  geoPayload,
  isValidCoordinate,
  smsPayload,
  telPayload,
  vcardPayload,
  wifiPayload,
} from '@/lib/qr/payloads';
import { RESERVED_PREFIX_LENGTH, budgetedLength, receiveUrl, siteBase } from '@/lib/share/link';

describe('wifiPayload', () => {
  it('escapes reserved characters', () => {
    expect(wifiPayload({ ssid: 'My;Net', password: 'p:a,s"s\\', security: 'WPA', hidden: false })).toBe(
      'WIFI:T:WPA;S:My\\;Net;P:p\\:a\\,s\\"s\\\\;;'
    );
  });

  it('omits the password for open networks and marks hidden ones', () => {
    expect(wifiPayload({ ssid: 'Cafe', password: 'ignored', security: 'nopass', hidden: true })).toBe(
      'WIFI:T:nopass;S:Cafe;H:true;;'
    );
  });
});

describe('vcardPayload', () => {
  it('writes required fields and skips empty ones', () => {
    const card = vcardPayload({
      name: '张三',
      org: 'A, B; C',
      title: '',
      phone: '+86 138 0000 0000',
      email: '',
      url: '',
      address: '',
      note: 'line1\nline2',
    });
    expect(card.split('\r\n')).toEqual([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:张三;;;;',
      'FN:张三',
      'ORG:A\\, B\\; C',
      'TEL;TYPE=CELL:+86 138 0000 0000',
      'NOTE:line1\\nline2',
      'END:VCARD',
    ]);
  });
});

describe('simple payloads', () => {
  it('builds mailto with %20 spaces', () => {
    expect(emailPayload({ to: 'a@b.c', subject: 'Hi there', body: '' })).toBe('mailto:a@b.c?subject=Hi%20there');
    expect(emailPayload({ to: 'a@b.c', subject: '', body: '' })).toBe('mailto:a@b.c');
  });

  it('builds sms, tel and geo', () => {
    expect(smsPayload({ phone: '10086', message: 'CXLL' })).toBe('SMSTO:10086:CXLL');
    expect(telPayload('+86 (10) 1234-5678')).toBe('tel:+861012345678');
    expect(geoPayload({ latitude: '39.9', longitude: '116.4', label: '天安门' })).toBe(
      `geo:39.9,116.4?q=${encodeURIComponent('天安门')}`
    );
  });

  it('validates coordinates', () => {
    expect(isValidCoordinate('-33.86', 90)).toBe(true);
    expect(isValidCoordinate('91', 90)).toBe(false);
    expect(isValidCoordinate('1e3', 180)).toBe(false);
  });

  it('builds an event with floating local times', () => {
    expect(
      eventPayload({ title: 'Sync', start: '2026-09-28T09:30', end: '', location: '', description: '' }).split('\r\n')
    ).toEqual(['BEGIN:VEVENT', 'SUMMARY:Sync', 'DTSTART:20260928T093000', 'END:VEVENT']);
  });
});

describe('encodeQr', () => {
  it('encodes UTF-8 text and reports its size', () => {
    const result = encodeQr('你好');
    expect(result.ok && result.qr.bytes).toBe(6);
  });

  it('reports empty and oversized input instead of throwing', () => {
    expect(encodeQr('')).toEqual({ ok: false, reason: 'empty' });
    expect(encodeQr('x'.repeat(3000), 'L')).toEqual({ ok: false, reason: 'too-long' });
  });

  it('treats codes above the given version as too long', () => {
    const text = 'x'.repeat(1000);
    const full = encodeQr(text, 'L');
    expect(full.ok && full.qr.version).toBeGreaterThan(20);
    expect(encodeQr(text, 'L', 20)).toEqual({ ok: false, reason: 'too-long' });
    expect(fitsBytes(800, 'L', 20)).toBe(true);
    expect(fitsBytes(1000, 'L', 20)).toBe(false);
  });

  it('merges horizontal runs into one path segment', () => {
    expect(modulesToPath([[true, true, false, true]], 0)).toBe('M0 0h2v1h-2zM3 0h1v1h-1z');
  });
});

describe('receive links', () => {
  it('puts the envelope in the fragment under r/', () => {
    expect(receiveUrl('data=AA', 'https://example.github.io/tools/')).toBe(
      'https://example.github.io/tools/r/#data=AA'
    );
  });

  it('budgets at least the reserved prefix', () => {
    expect(budgetedLength('abc', 'http://a/')).toBe(RESERVED_PREFIX_LENGTH + 3);
    const long = `https://${'x'.repeat(100)}/`;
    expect(budgetedLength('abc', long)).toBe(long.length + 3 + 3);
  });
});

describe('siteBase', () => {
  it('is the site root from the main page and from the receive page alike', () => {
    expect(siteBase({ href: 'https://example.github.io/tools/#/share' })).toBe('https://example.github.io/tools/');
    expect(siteBase({ href: 'https://example.github.io/tools/r/#data=AA' })).toBe('https://example.github.io/tools/');
    expect(siteBase({ href: 'http://192.168.1.2:5173/r/' })).toBe('http://192.168.1.2:5173/');
  });
});
