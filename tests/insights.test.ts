import { describe, expect, it } from "vitest";

import {
  costPerWear,
  leastWorn,
  mostWorn,
  occasionCoverage,
  retireCandidates,
  summarize,
  type InsightGarment,
} from "@/lib/insights";

const NOW = new Date("2026-09-28T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function item(over: Partial<InsightGarment> = {}): InsightGarment {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    subcategory: "shirt",
    category: "TOP",
    formality: 3,
    status: "AVAILABLE",
    wearCount: 0,
    lastWornAt: null,
    createdAt: daysAgo(30),
    priceCents: null,
    isFavorite: false,
    ...over,
  };
}

describe("mostWorn / leastWorn", () => {
  it("ranks by wear count and ignores unworn items in mostWorn", () => {
    const garments = [
      item({ id: "a", wearCount: 9 }),
      item({ id: "b", wearCount: 2 }),
      item({ id: "c", wearCount: 0 }),
    ];
    expect(mostWorn(garments).map((g) => g.id)).toEqual(["a", "b"]);
    expect(leastWorn(garments)[0].id).toBe("c");
  });

  it("excludes retired items from leastWorn — already dealt with", () => {
    const garments = [
      item({ id: "retired", wearCount: 0, status: "RETIRED" }),
      item({ id: "live", wearCount: 1 }),
    ];
    expect(leastWorn(garments).map((g) => g.id)).toEqual(["live"]);
  });
});

describe("costPerWear", () => {
  it("divides price by wears", () => {
    const [result] = costPerWear([item({ priceCents: 10_000, wearCount: 4 })]);
    expect(result.centsPerWear).toBe(2_500);
  });

  it("charges an unworn item its full price", () => {
    const [result] = costPerWear([item({ priceCents: 8_000, wearCount: 0 })]);
    expect(result.centsPerWear).toBe(8_000);
  });

  it("skips items with no price rather than guessing one", () => {
    expect(costPerWear([item({ priceCents: null, wearCount: 3 })])).toEqual([]);
  });

  it("puts the worst value first", () => {
    const result = costPerWear([
      item({ id: "good", priceCents: 10_000, wearCount: 50 }),
      item({ id: "bad", priceCents: 30_000, wearCount: 1 }),
    ]);
    expect(result[0].id).toBe("bad");
  });
});

describe("retireCandidates", () => {
  it("flags old, never-worn items", () => {
    const result = retireCandidates([item({ id: "old", createdAt: daysAgo(400) })], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("never worn");
  });

  it("leaves recent purchases alone", () => {
    expect(retireCandidates([item({ createdAt: daysAgo(20) })], NOW)).toEqual([]);
  });

  it("never suggests retiring a favourite", () => {
    const favourite = item({ createdAt: daysAgo(500), isFavorite: true });
    expect(retireCandidates([favourite], NOW)).toEqual([]);
  });

  it("flags something worn once, long ago", () => {
    const result = retireCandidates(
      [item({ createdAt: daysAgo(500), wearCount: 1, lastWornAt: daysAgo(400) })],
      NOW,
    );
    expect(result).toHaveLength(1);
  });

  it("keeps something worn once but recently", () => {
    const result = retireCandidates(
      [item({ createdAt: daysAgo(500), wearCount: 1, lastWornAt: daysAgo(10) })],
      NOW,
    );
    expect(result).toEqual([]);
  });
});

describe("occasionCoverage", () => {
  it("reports an occasion as uncovered when shoes are missing", () => {
    const garments = [
      item({ category: "TOP", formality: 4 }),
      item({ category: "BOTTOM", formality: 4 }),
    ];
    const interview = occasionCoverage(garments).find((o) => o.occasion === "interview");
    expect(interview?.covered).toBe(false);
    expect(interview?.missing).toContain("shoes");
  });

  it("counts a one-piece as covering top and bottom", () => {
    const garments = [
      item({ category: "ONE_PIECE", formality: 4 }),
      item({ category: "FOOTWEAR", formality: 4 }),
    ];
    const interview = occasionCoverage(garments).find((o) => o.occasion === "interview");
    expect(interview?.covered).toBe(true);
  });

  it("ignores items outside the occasion's formality window", () => {
    const garments = [
      item({ category: "TOP", formality: 1 }),
      item({ category: "BOTTOM", formality: 1 }),
      item({ category: "FOOTWEAR", formality: 1 }),
    ];
    const interview = occasionCoverage(garments).find((o) => o.occasion === "interview");
    const gym = occasionCoverage(garments).find((o) => o.occasion === "gym");
    expect(interview?.covered).toBe(false);
    expect(gym?.covered).toBe(true);
  });

  it("ignores items that are not available", () => {
    const garments = [
      item({ category: "TOP", formality: 2, status: "IN_LAUNDRY" }),
      item({ category: "BOTTOM", formality: 2 }),
      item({ category: "FOOTWEAR", formality: 2 }),
    ];
    const casual = occasionCoverage(garments).find((o) => o.occasion === "casual");
    expect(casual?.missing).toContain("a top");
  });
});

describe("summarize", () => {
  it("totals the wardrobe", () => {
    const result = summarize([
      item({ wearCount: 3, priceCents: 5_000 }),
      item({ wearCount: 0, status: "IN_LAUNDRY" }),
      item({ wearCount: 0 }),
    ]);
    expect(result).toMatchObject({
      total: 3,
      available: 2,
      inLaundry: 1,
      neverWorn: 2,
      totalWears: 3,
      valueCents: 5_000,
    });
  });
});
