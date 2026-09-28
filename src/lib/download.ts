import { QUIET_ZONE, type QrMatrix, qrToSvg } from '@/lib/qr/encode';

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Gives the browser a moment to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(qr: QrMatrix, filename: string): void {
  saveBlob(new Blob([qrToSvg(qr)], { type: 'image/svg+xml' }), `${filename}.svg`);
}

/** Draws whole pixels per module, so the PNG stays sharp at any size it is shown. */
function renderPng(qr: QrMatrix, targetSize = 1024): Promise<Blob> {
  const full = qr.size + QUIET_ZONE * 2;
  const scale = Math.max(1, Math.floor(targetSize / full));
  const canvas = document.createElement('canvas');
  canvas.width = full * scale;
  canvas.height = full * scale;
  const context = canvas.getContext('2d');
  if (!context) {
    return Promise.reject(new Error('Canvas 2D is not available'));
  }
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  qr.modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect((x + QUIET_ZONE) * scale, (y + QUIET_ZONE) * scale, scale, scale);
      }
    });
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png')
  );
}

export function downloadPng(qr: QrMatrix, filename: string): void {
  void renderPng(qr).then((blob) => saveBlob(blob, `${filename}.png`));
}

/**
 * Writing images to the clipboard needs a secure context (HTTPS or localhost) and `ClipboardItem`;
 * unlike text, there is no fallback on a plain-HTTP LAN address.
 */
export function canCopyImages(): boolean {
  return (
    window.isSecureContext && typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'
  );
}

/**
 * Copies the code as a PNG. The image is handed over as a promise, so the write starts within the click:
 * Safari rejects clipboard writes that begin after an await.
 */
export async function copyPng(qr: QrMatrix): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderPng(qr) })]);
    return true;
  } catch {
    return false;
  }
}
