import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";

export interface StoredFile {
  /** Opaque key the adapter can resolve back to bytes. */
  key: string;
  /** URL the browser can load the file from. */
  url: string;
  bytes: number;
  contentType: string;
}

/**
 * Image storage boundary. Dev writes to ./uploads and serves through
 * /api/uploads/[...path]; swapping in S3/R2 later means implementing this
 * interface and changing the one export at the bottom of this file.
 */
export interface StorageAdapter {
  put(
    data: Buffer,
    opts: { contentType: string; extension?: string; prefix?: string },
  ): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  /** Absolute filesystem path, or null for adapters without local files. */
  localPath(key: string): string | null;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
};

class LocalDiskStorage implements StorageAdapter {
  constructor(private readonly root: string) {}

  async put(
    data: Buffer,
    opts: { contentType: string; extension?: string; prefix?: string },
  ): Promise<StoredFile> {
    const ext =
      opts.extension ?? EXTENSION_BY_TYPE[opts.contentType] ?? "bin";
    const prefix = opts.prefix ? `${sanitizeSegment(opts.prefix)}/` : "";
    const key = `${prefix}${randomUUID()}.${ext}`;
    const target = this.resolve(key);

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);

    return {
      key,
      url: `/api/uploads/${key}`,
      bytes: data.byteLength,
      contentType: opts.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => {
      // Deleting an already-missing file is not an error worth surfacing.
    });
  }

  localPath(key: string): string {
    return this.resolve(key);
  }

  /** Resolve a key inside the root, refusing anything that escapes it. */
  private resolve(key: string): string {
    const root = path.resolve(this.root);
    const target = path.resolve(root, key);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`Storage key escapes the upload root: ${key}`);
    }
    return target;
  }
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Stable hash of file bytes — used to skip re-processing duplicate uploads. */
export function contentHash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 32);
}

export const storage: StorageAdapter = new LocalDiskStorage(env.UPLOAD_DIR);
