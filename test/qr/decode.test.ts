import { describe, expect, it } from 'vitest';

import { decodePixels } from '@/lib/qr/decode';
import { QUIET_ZONE, encodeQr } from '@/lib/qr/encode';

/** Renders a code the way a screenshot shows it: `scale` pixels per module, with a quiet zone. */
function render(text: string, { scale = 4, invert = false } = {}) {
  const result = encodeQr(text);
  if (!result.ok) {
    throw new Error('cannot encode');
  }
  const { size, modules } = result.qr;
  const side = (size + QUIET_ZONE * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const my = Math.floor(y / scale) - QUIET_ZONE;
      const mx = Math.floor(x / scale) - QUIET_ZONE;
      const dark = modules[my]?.[mx] === true;
      const value = dark !== invert ? 0 : 255;
      data.set([value, value, value, 255], (y * side + x) * 4);
    }
  }
  return { data, width: side, height: side };
}

describe('decodePixels', () => {
  it('reads a key URI back', () => {
    const uri = 'otpauth://totp/ACME:alice?secret=JBSWY3DPEHPK3PXP&issuer=ACME';
    expect(decodePixels(render(uri))).toBe(uri);
  });

  it('reads UTF-8 text', () => {
    expect(decodePixels(render('订阅地址：https://example.com'))).toBe('订阅地址：https://example.com');
  });

  it('reads light-on-dark codes', () => {
    expect(decodePixels(render('inverted', { invert: true }))).toBe('inverted');
  });

  it('returns null when there is no code', () => {
    const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255);
    expect(decodePixels({ data: blank, width: 64, height: 64 })).toBeNull();
  });
});
