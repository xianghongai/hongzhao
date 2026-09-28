import jsQR from 'jsqr';

/** RGBA pixels, the shape of `ImageData`, so decoding stays testable without a DOM. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Finds one QR code in the pixels; also tries light-on-dark codes, common in dark-mode screenshots. */
export function decodePixels({ data, width, height }: Pixels): string | null {
  return jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}
