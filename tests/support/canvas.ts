import type { Locator } from '@playwright/test';

/** Compare exact output without writing multi-megabyte base64 strings into traces. */
export function canvasFingerprint(canvas: Locator) {
  return canvas.evaluate(async (element: HTMLCanvasElement) => {
    const copy = document.createElement('canvas'); copy.width = element.width; copy.height = element.height;
    const context = copy.getContext('2d')!; context.drawImage(element, 0, 0);
    // Read one rendered frame synchronously; PNG encoding may finish on a later frame.
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const hash = await crypto.subtle.digest('SHA-256', pixels.buffer);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  });
}
