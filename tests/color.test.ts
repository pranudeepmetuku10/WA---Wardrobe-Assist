import { describe, expect, it } from "vitest";

import {
  classifyPair,
  hexToHsl,
  hueDistance,
  isNeutral,
  outfitColorScore,
} from "@/lib/rules/color";

describe("hexToHsl", () => {
  it("converts primaries", () => {
    expect(hexToHsl("#ff0000").h).toBeCloseTo(0, 0);
    expect(hexToHsl("#00ff00").h).toBeCloseTo(120, 0);
    expect(hexToHsl("#0000ff").h).toBeCloseTo(240, 0);
  });

  it("reports greys as unsaturated", () => {
    expect(hexToHsl("#808080").s).toBe(0);
  });

  it("accepts shorthand hex", () => {
    expect(hexToHsl("#fff").l).toBeCloseTo(1, 1);
  });
});

describe("isNeutral", () => {
  it("treats wardrobe staples as neutral", () => {
    for (const hex of [
      "#ffffff", // white
      "#000000", // black
      "#808080", // grey
      "#cfc3ae", // stone chinos
      "#1b2631", // navy
      "#f5f3ef", // off-white tee
    ]) {
      expect(isNeutral(hex), hex).toBe(true);
    }
  });

  it("does not treat saturated colours as neutral", () => {
    for (const hex of ["#d21919", "#1e40af", "#16a34a"]) {
      expect(isNeutral(hex), hex).toBe(false);
    }
  });
});

describe("hueDistance", () => {
  it("wraps around the colour wheel", () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
  });
});

describe("classifyPair", () => {
  it("calls anything with a neutral neutral", () => {
    expect(classifyPair("#ffffff", "#d21919")).toBe("neutral");
  });

  it("recognises monochrome, analogous and complementary", () => {
    expect(classifyPair("#d21919", "#e04b4b")).toBe("monochrome");
    expect(classifyPair("#d21919", "#d97706")).toBe("analogous");
    expect(classifyPair("#1e40af", "#d97706")).toBe("complementary");
  });

  it("flags the awkward middle distance as a clash", () => {
    // ~70 degrees apart: reads as a mistake rather than a choice.
    expect(classifyPair("#d21919", "#b8b81e")).toBe("clash");
  });
});

describe("outfitColorScore", () => {
  const solid = (hex: string) => ({
    colors: [{ name: "c", hex, role: "primary" as const }],
    pattern: "SOLID" as const,
  });

  it("rewards a neutral outfit", () => {
    const score = outfitColorScore([
      solid("#6b7245"),
      solid("#cfc3ae"),
      solid("#6f4a2f"),
    ]);
    expect(score).toBeGreaterThan(0.6);
  });

  it("punishes a genuine clash", () => {
    const clash = outfitColorScore([solid("#d21919"), solid("#b8b81e")]);
    const harmony = outfitColorScore([solid("#cfc3ae"), solid("#6b7245")]);
    expect(clash).toBeLessThan(harmony);
    expect(clash).toBeLessThan(0.4);
  });

  it("penalises two loud patterns without banning them", () => {
    const patterned = outfitColorScore([
      { colors: [{ name: "a", hex: "#cfc3ae", role: "primary" }], pattern: "STRIPED" },
      { colors: [{ name: "b", hex: "#6b7245", role: "primary" }], pattern: "CHECKED" },
    ]);
    // Penalised, but still on the board — a bold choice, not an error.
    expect(patterned).toBeLessThan(0.75);
    expect(patterned).toBeGreaterThan(0);
  });

  it("is forgiving when there is nothing to clash with", () => {
    expect(outfitColorScore([solid("#d21919")])).toBeGreaterThan(0.5);
  });
});
