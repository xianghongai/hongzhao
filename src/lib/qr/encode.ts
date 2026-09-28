import { encode } from 'uqr';

export type Ecc = 'L' | 'M' | 'Q' | 'H';

/** The quiet zone the QR specification asks for, in modules. */
export const QUIET_ZONE = 4;

/** Above this version, a code shown on a screen gets hard for phone cameras to read. */
export const DENSE_VERSION = 20;

export interface QrMatrix {
  version: number;
  /** Width and height in modules, without the quiet zone. */
  size: number;
  modules: boolean[][];
  /** The UTF-8 length of the encoded text. */
  bytes: number;
}

export type QrResult = { ok: true; qr: QrMatrix } | { ok: false; reason: 'empty' | 'too-long' };

/** Encodes `text`, treating anything that needs a version above `maxVersion` as too long. */
export function encodeQr(text: string, ecc: Ecc = 'M', maxVersion: number = 40): QrResult {
  if (text === '') {
    return { ok: false, reason: 'empty' };
  }
  try {
    const { version, size, data } = encode(text, { ecc, border: 0 });
    if (version > maxVersion) {
      return { ok: false, reason: 'too-long' };
    }
    return { ok: true, qr: { version, size, modules: data, bytes: new TextEncoder().encode(text).length } };
  } catch {
    // uqr throws a RangeError when the data exceeds version 40 at this error-correction level.
    return { ok: false, reason: 'too-long' };
  }
}

/**
 * Builds one SVG path for all dark modules, merging horizontal runs,
 * with coordinates offset by the quiet zone.
 */
export function modulesToPath(modules: boolean[][], offset: number = QUIET_ZONE): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) {
        x += 1;
      }
      parts.push(`M${start + offset} ${y + offset}h${x - start}v1h${start - x}z`);
    }
  });
  return parts.join('');
}

export function qrToSvg(qr: QrMatrix, { dark = '#000', light = '#fff' } = {}): string {
  const full = qr.size + QUIET_ZONE * 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges">` +
    `<rect width="${full}" height="${full}" fill="${light}"/>` +
    `<path d="${modulesToPath(qr.modules)}" fill="${dark}"/>` +
    '</svg>'
  );
}

/** Whether `length` bytes of arbitrary text fit in one code at this error-correction level and version. */
export function fitsBytes(length: number, ecc: Ecc, maxVersion: number = 40): boolean {
  // Lowercase letters force byte mode, the least dense one, like any real URL.
  return encodeQr('x'.repeat(length), ecc, maxVersion).ok;
}
