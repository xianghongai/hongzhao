/**
 * The pages are laid out for phones, so zooming is turned off. The viewport meta stops it in most browsers and
 * `touch-action` in `src/index.css` stops double-tap zoom, but iOS Safari ignores both for pinching:
 * only cancelling its gesture events, or a touch move with more than one finger, stops that.
 */
export function preventZoom(): void {
  const cancel = (event: Event) => event.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, cancel, { passive: false });
  }
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );
}
