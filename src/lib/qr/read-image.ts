import { decodePixels } from '@/lib/qr/decode';

/** Large screenshots are scanned downscaled first: faster, and usually enough for a crisp code. */
const FAST_SIDE = 1600;

/** The native detector is not in the TypeScript DOM library yet. */
interface NativeBarcodeDetector {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorClass = (new (options: { formats: string[] }) => NativeBarcodeDetector) & {
  getSupportedFormats(): Promise<string[]>;
};

/** Something both the native detector and a canvas can read: a decoded image or a playing video. */
export type QrSource = ImageBitmap | HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas;

async function detectNatively(source: QrSource): Promise<string[]> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (!Detector) {
    return [];
  }
  try {
    if (!(await Detector.getSupportedFormats()).includes('qr_code')) {
      return [];
    }
    const results = await new Detector({ formats: ['qr_code'] }).detect(source);
    return results.map((result) => result.rawValue);
  } catch {
    return [];
  }
}

function detectWithJs(source: QrSource, sourceWidth: number, sourceHeight: number, fastSide: number): string[] {
  const longest = Math.max(sourceWidth, sourceHeight);
  const scales = longest > fastSide ? [fastSide / longest, 1] : [1];
  for (const scale of scales) {
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return [];
    }
    context.drawImage(source, 0, 0, width, height);
    const text = decodePixels(context.getImageData(0, 0, width, height));
    if (text !== null) {
      return [text];
    }
  }
  return [];
}

/**
 * Reads the QR codes in any drawable source, entirely on this device.
 * The native `BarcodeDetector` finds several codes at once where the browser has it;
 * elsewhere, or when it finds nothing, jsQR finds one.
 * `fastSide` bounds the first, downscaled pass; video frames use a smaller one to keep up with the camera.
 */
export async function readQrCodesFrom(
  source: QrSource,
  width: number,
  height: number,
  fastSide: number = FAST_SIDE
): Promise<string[]> {
  if (width === 0 || height === 0) {
    return [];
  }
  const native = await detectNatively(source);
  const texts = native.length > 0 ? native : detectWithJs(source, width, height, fastSide);
  return [...new Set(texts.filter((text) => text !== ''))];
}

/** The image itself could not be decoded, as opposed to holding no QR code. */
export class ImageReadError extends Error {}

/** Reads the QR codes in an image file or pasted screenshot. */
export async function readQrCodes(image: Blob): Promise<string[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    throw new ImageReadError('unreadable image');
  }
  try {
    return await readQrCodesFrom(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}
