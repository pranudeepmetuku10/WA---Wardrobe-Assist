import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { storage } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
};

/** Serves garment photos out of the local dev upload directory. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const key = segments.join("/");

  let filePath: string | null;
  try {
    filePath = storage.localPath(key);
  } catch {
    // Key tried to escape the upload root.
    return new Response("Not found", { status: 404 });
  }
  if (!filePath) return new Response("Not found", { status: 404 });

  const stats = await stat(filePath).catch(() => null);
  if (!stats?.isFile()) return new Response("Not found", { status: 404 });

  const extension = key.split(".").pop()?.toLowerCase() ?? "";
  const stream = Readable.toWeb(
    createReadStream(filePath),
  ) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Content-Length": String(stats.size),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
