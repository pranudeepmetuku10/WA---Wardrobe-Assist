/**
 * Client-side image preparation.
 *
 * Resizing before upload is what keeps vision cost and latency down: 1568px on
 * the long edge is the point past which extra pixels buy the model nothing.
 * We also produce a small thumbnail so grids stay fast on a phone.
 */

/**
 * 1568px is the point past which a hosted vision model gains nothing. Local
 * models are compute-bound rather than pixel-hungry: 1024px halves extraction
 * time on an M4 with no measurable loss on garment attributes. Raise this if
 * you switch to a hosted provider.
 */
export const MAX_EDGE = 1024;
export const THUMB_EDGE = 400;

export interface PreparedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file).catch(() => {
    // Safari can refuse HEIC here even though the picker offered it.
    throw new Error(
      `Could not read ${file.name}. Try JPEG or PNG — HEIC is not always supported.`,
    );
  });

  try {
    const full = await drawScaled(bitmap, MAX_EDGE, 0.85);
    const thumb = await drawScaled(bitmap, THUMB_EDGE, 0.7);
    return { full, thumb, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

async function drawScaled(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image encoding failed")),
      "image/jpeg",
      quality,
    );
  });
}

/** Runs tasks with a fixed concurrency so one slow item can't stall the batch. */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      // Never let one rejection abort the rest of the batch.
      await worker(items[index], index).catch(() => undefined);
    }
  });
  await Promise.all(runners);
}
