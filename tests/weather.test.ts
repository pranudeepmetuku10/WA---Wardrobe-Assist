import { describe, expect, it } from "vitest";

import {
  breathability,
  needsOuterwear,
  rejectsOuterwear,
  targetWarmth,
  weatherScore,
  type WeatherConditions,
} from "@/lib/rules/weather";

const HOT_HUMID: WeatherConditions = {
  temperatureC: 34,
  humidity: 78,
  precipitationChance: 10,
};
const COLD: WeatherConditions = {
  temperatureC: 4,
  humidity: 60,
  precipitationChance: 10,
};
const RAINY: WeatherConditions = {
  temperatureC: 22,
  humidity: 85,
  precipitationChance: 80,
};

describe("targetWarmth", () => {
  it("asks for the lightest clothing in real heat", () => {
    expect(targetWarmth(35)).toBe(1);
  });
  it("asks for the heaviest in real cold", () => {
    expect(targetWarmth(2)).toBe(5);
  });
  it("moves monotonically", () => {
    const points = [35, 27, 22, 17, 10, 2].map(targetWarmth);
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i]).toBeGreaterThanOrEqual(points[i - 1]);
    }
  });
});

describe("breathability", () => {
  it("ranks linen above wool", () => {
    expect(breathability(["LINEN"])).toBeGreaterThan(breathability(["WOOL"]));
  });
  it("is limited by the least breathable layer", () => {
    expect(breathability(["LINEN", "LEATHER"])).toBe(breathability(["LEATHER"]));
  });
});

describe("weatherScore", () => {
  it("must not favour wool at 34C — the rubric case", () => {
    const wool = weatherScore(
      { warmth: 5, materials: ["WOOL"], category: "TOP" },
      HOT_HUMID,
    );
    const linen = weatherScore(
      { warmth: 1, materials: ["LINEN"], category: "TOP" },
      HOT_HUMID,
    );
    expect(linen).toBeGreaterThan(0.8);
    expect(wool).toBeLessThan(0.2);
  });

  it("prefers linen over cotton when it is humid", () => {
    const linen = weatherScore(
      { warmth: 1, materials: ["LINEN"], category: "TOP" },
      HOT_HUMID,
    );
    const cotton = weatherScore(
      { warmth: 1, materials: ["COTTON"], category: "TOP" },
      HOT_HUMID,
    );
    expect(linen).toBeGreaterThan(cotton);
  });

  it("flips the ranking in the cold", () => {
    const wool = weatherScore(
      { warmth: 5, materials: ["WOOL"], category: "OUTERWEAR" },
      COLD,
    );
    const linen = weatherScore(
      { warmth: 1, materials: ["LINEN"], category: "TOP" },
      COLD,
    );
    expect(wool).toBeGreaterThan(linen);
  });

  it("penalises suede shoes in the rain harder than a suede bag", () => {
    const shoes = weatherScore(
      { warmth: 2, materials: ["SUEDE"], category: "FOOTWEAR" },
      RAINY,
    );
    const bag = weatherScore(
      { warmth: 2, materials: ["SUEDE"], category: "BAG" },
      RAINY,
    );
    expect(shoes).toBeLessThan(bag);
  });

  it("dresses for the room when indoors", () => {
    const outdoors = weatherScore(
      { warmth: 3, materials: ["COTTON"], category: "TOP" },
      { temperatureC: 34, humidity: 50, precipitationChance: 0 },
    );
    const indoors = weatherScore(
      { warmth: 3, materials: ["COTTON"], category: "TOP" },
      { temperatureC: 34, humidity: 50, precipitationChance: 0, indoor: true },
    );
    expect(indoors).toBeGreaterThan(outdoors);
  });
});

describe("outerwear rules", () => {
  it("wants a layer when cold, wet or windy", () => {
    expect(needsOuterwear(COLD)).toBe(true);
    expect(needsOuterwear(RAINY)).toBe(true);
    expect(needsOuterwear(HOT_HUMID)).toBe(false);
  });

  it("refuses a layer in dry heat", () => {
    expect(rejectsOuterwear(HOT_HUMID)).toBe(true);
    expect(rejectsOuterwear(COLD)).toBe(false);
  });
});
