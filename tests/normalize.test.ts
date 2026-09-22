import { describe, expect, it } from "vitest";

import {
  clampWarmth,
  normalizeColors,
  normalizeSeasons,
  normalizeStyleTags,
  normalizeSubcategory,
} from "@/lib/garments/normalize";

describe("clampWarmth", () => {
  it("caps linen at 2 no matter what the model claimed", () => {
    // The real failure we saw: a linen blazer returned warmth 4.
    expect(clampWarmth(4, ["LINEN"])).toBe(2);
  });

  it("raises wool to at least 3", () => {
    expect(clampWarmth(1, ["WOOL"])).toBe(3);
  });

  it("lets plausible values through untouched", () => {
    expect(clampWarmth(2, ["COTTON"])).toBe(2);
    expect(clampWarmth(5, ["DOWN"])).toBe(5);
  });

  it("uses the most restrictive range for a blend", () => {
    // Linen-cotton breathes like linen.
    expect(clampWarmth(4, ["LINEN", "COTTON"])).toBe(2);
  });

  it("leaves unknown materials alone", () => {
    expect(clampWarmth(3, ["OTHER"])).toBe(3);
    expect(clampWarmth(3, [])).toBe(3);
  });
});

describe("normalizeSeasons", () => {
  it("drops ALL_SEASON when specific seasons are present", () => {
    expect(normalizeSeasons(["AUTUMN", "ALL_SEASON"], ["COTTON"])).toEqual([
      "AUTUMN",
    ]);
  });

  it("refuses winter for linen and falls back to summer", () => {
    // The exact contradiction the 4b model produced.
    expect(normalizeSeasons(["AUTUMN", "WINTER", "ALL_SEASON"], ["LINEN"]))
      .toEqual(["AUTUMN"]);
    expect(normalizeSeasons(["WINTER"], ["LINEN"])).toEqual(["SUMMER"]);
  });

  it("refuses summer for wool", () => {
    expect(normalizeSeasons(["SUMMER"], ["WOOL"])).toEqual(["WINTER"]);
  });

  it("defaults to ALL_SEASON when nothing survives", () => {
    expect(normalizeSeasons([], ["COTTON"])).toEqual(["ALL_SEASON"]);
  });

  it("de-duplicates", () => {
    expect(normalizeSeasons(["SUMMER", "SUMMER"], ["COTTON"])).toEqual([
      "SUMMER",
    ]);
  });
});

describe("normalizeSubcategory", () => {
  it("takes the first term and lowercases it", () => {
    expect(normalizeSubcategory("BLAZER/JACKET")).toBe("blazer");
    expect(normalizeSubcategory("Oxford  Shirt")).toBe("oxford shirt");
  });
});

describe("normalizeStyleTags", () => {
  it("strips colours and fabrics, keeping real style words", () => {
    expect(normalizeStyleTags(["navy", "linen", "blazer", "Business"])).toEqual([
      "business",
    ]);
  });

  it("de-duplicates and caps at five", () => {
    expect(normalizeStyleTags(["minimal", "minimal", "smart"])).toEqual([
      "minimal",
      "smart",
    ]);
    expect(normalizeStyleTags(["a1", "b2", "c3", "d4", "e5", "f6"])).toHaveLength(5);
  });
});

describe("normalizeColors", () => {
  it("guarantees exactly one primary", () => {
    const result = normalizeColors([
      { name: "Navy", hex: "#1B2631", role: "primary" },
      { name: "White", hex: "#FFFFFF", role: "primary" },
    ]);
    expect(result.filter((c) => c.role === "primary")).toHaveLength(1);
    expect(result[1].role).toBe("secondary");
  });

  it("promotes the first colour when none is primary", () => {
    const result = normalizeColors([
      { name: "olive", hex: "#6b7245", role: "accent" },
    ]);
    expect(result[0].role).toBe("primary");
  });

  it("drops duplicate hexes and lowercases", () => {
    const result = normalizeColors([
      { name: "Navy", hex: "#1B2631", role: "primary" },
      { name: "Navy", hex: "#1b2631", role: "secondary" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].hex).toBe("#1b2631");
  });
});
