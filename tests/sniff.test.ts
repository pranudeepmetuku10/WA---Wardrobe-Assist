import { describe, expect, it } from "vitest";

import { isModelReadable, sniffImageType } from "@/lib/images/sniff";

function bytes(...values: number[]): Buffer {
  return Buffer.concat([Buffer.from(values), Buffer.alloc(16)]);
}

describe("sniffImageType", () => {
  it("recognises JPEG, PNG, GIF and WebP", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(
      sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("image/png");
    expect(sniffImageType(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(16)])))
      .toBe("image/gif");
    expect(
      sniffImageType(
        Buffer.concat([
          Buffer.from("RIFF"),
          Buffer.from([0, 0, 0, 0]),
          Buffer.from("WEBP"),
          Buffer.alloc(8),
        ]),
      ),
    ).toBe("image/webp");
  });

  it("recognises HEIC and AVIF via the ftyp brand", () => {
    const heic = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from("ftypheic"),
      Buffer.alloc(8),
    ]);
    expect(sniffImageType(heic)).toBe("image/heic");

    const avif = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from("ftypavif"),
      Buffer.alloc(8),
    ]);
    expect(sniffImageType(avif)).toBe("image/avif");
  });

  it("rejects an HTML error page saved as .jpg", () => {
    // Exactly what a failed image download looks like.
    const html = Buffer.from("<!DOCTYPE html><html><body>404</body></html>");
    expect(sniffImageType(html)).toBeNull();
  });

  it("rejects truncated files", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe("isModelReadable", () => {
  it("accepts formats the vision models handle", () => {
    expect(isModelReadable("image/jpeg")).toBe(true);
    expect(isModelReadable("image/png")).toBe(true);
  });

  it("flags HEIC and AVIF for conversion", () => {
    // Recognisable, but the model cannot decode them.
    expect(isModelReadable("image/heic")).toBe(false);
    expect(isModelReadable("image/avif")).toBe(false);
  });
});
