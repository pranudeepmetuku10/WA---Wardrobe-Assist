import { extractGarments } from "@/lib/ai/extract";
import { createGarmentFromExtraction } from "@/lib/garments/persist";
import { isModelReadable, sniffImageType } from "@/lib/images/sniff";
import { storage } from "@/lib/storage";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * One photo in, one or more draft garments out.
 *
 * The client resizes before upload and posts the full-size image plus a
 * thumbnail. The image is stored first, so a failed extraction still leaves
 * something for manual entry rather than losing the upload.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { ok: false, error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json(
      { ok: false, error: "missing 'image' file field" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { ok: false, error: "image exceeds 12MB — resize before upload" },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Trust the bytes, not the declared type.
  const sniffed = sniffImageType(buffer);
  if (!sniffed) {
    return Response.json(
      { ok: false, error: "that file is not an image" },
      { status: 415 },
    );
  }
  if (!isModelReadable(sniffed)) {
    return Response.json(
      {
        ok: false,
        error: `${sniffed} cannot be read directly — convert to JPEG or PNG first`,
      },
      { status: 415 },
    );
  }

  const stored = await storage.put(buffer, {
    contentType: sniffed,
    prefix: "garments",
  });

  const thumbFile = form.get("thumbnail");
  let thumb = null;
  if (thumbFile instanceof File && thumbFile.size <= MAX_BYTES) {
    const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer());
    const thumbType = sniffImageType(thumbBuffer);
    if (thumbType && isModelReadable(thumbType)) {
      thumb = await storage.put(thumbBuffer, {
        contentType: thumbType,
        prefix: "thumbs",
      });
    }
  }

  const note = typeof form.get("note") === "string"
    ? (form.get("note") as string).slice(0, 400)
    : undefined;

  const outcome = await extractGarments({
    image: { base64: buffer.toString("base64"), mediaType: sniffed },
    description: note,
  });

  // Extraction failed twice — hand the item to manual entry, image intact.
  if (!outcome.result) {
    return Response.json(
      {
        ok: false,
        needsManualEntry: true,
        imageUrl: stored.url,
        thumbnailUrl: thumb?.url ?? stored.url,
        error: outcome.error,
        latencyMs: outcome.latencyMs,
      },
      { status: 200 },
    );
  }

  const garments = [];
  for (const item of outcome.result.items) {
    garments.push(
      await createGarmentFromExtraction({
        item,
        imageUrl: stored.url,
        thumbnailUrl: thumb?.url ?? stored.url,
        notes: note ?? null,
      }),
    );
  }

  return Response.json({
    ok: true,
    garments,
    multipleItems: garments.length > 1,
    latencyMs: outcome.latencyMs,
    costUsd: outcome.costUsd,
    attempts: outcome.attempts,
  });
}
