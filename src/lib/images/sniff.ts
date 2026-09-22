/**
 * Identify an image from its bytes.
 *
 * A browser-supplied Content-Type is a claim, not a fact — a broken download
 * or a renamed file arrives as "image/jpeg" and reaches the model as garbage,
 * which surfaces as an opaque provider error. Sniffing turns that into a clear
 * 415 before we spend a model call on it.
 */
export type SniffedType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | "image/heic"
  | "image/gif";

export function sniffImageType(buffer: Buffer): SniffedType | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return "image/png";
  }
  // GIF87a / GIF89a
  if (buffer.subarray(0, 3).toString("ascii") === "GIF") {
    return "image/gif";
  }
  // RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  // ISO-BMFF family: ....ftyp<brand>
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif";
    if (
      brand.startsWith("heic") ||
      brand.startsWith("heix") ||
      brand.startsWith("hevc") ||
      brand.startsWith("mif1")
    ) {
      return "image/heic";
    }
  }
  return null;
}

/** Types the vision models can actually read. */
const MODEL_READABLE = new Set<SniffedType>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isModelReadable(type: SniffedType): boolean {
  return MODEL_READABLE.has(type);
}
