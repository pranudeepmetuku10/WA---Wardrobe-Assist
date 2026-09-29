import { describe, expect, it } from "vitest";

import { calibrateConfidence, tidyPreferences } from "@/lib/learning/preferences";

const base = {
  summary: "You wear mostly neutrals.",
  colorsGravitatedTo: ["navy"],
  colorsAvoidedInPractice: [],
  combinationsRejected: [],
  formalityByOccasion: [],
  neverWorn: [],
  confidence: 0.95,
};

describe("calibrateConfidence", () => {
  it("caps confidence by how much evidence there actually is", () => {
    // The real case: 0.95 self-reported from eight events.
    expect(calibrateConfidence(0.95, 8)).toBe(0.2);
  });

  it("allows high confidence once the log is substantial", () => {
    expect(calibrateConfidence(0.9, 40)).toBe(0.9);
    expect(calibrateConfidence(0.9, 100)).toBe(0.9);
  });

  it("never raises a low self-assessment", () => {
    expect(calibrateConfidence(0.3, 100)).toBe(0.3);
  });
});

describe("tidyPreferences", () => {
  it("strips placeholder answers that read as findings", () => {
    const result = tidyPreferences(
      {
        ...base,
        colorsGravitatedTo: ["unknown", "navy"],
        colorsAvoidedInPractice: ["all available"],
        neverWorn: ["none", "  ", "white kurta"],
      },
      20,
    );
    expect(result.colorsGravitatedTo).toEqual(["navy"]);
    expect(result.colorsAvoidedInPractice).toEqual([]);
    expect(result.neverWorn).toEqual(["white kurta"]);
  });

  it("leaves real answers alone", () => {
    const result = tidyPreferences(
      { ...base, colorsGravitatedTo: ["olive", "stone"] },
      40,
    );
    expect(result.colorsGravitatedTo).toEqual(["olive", "stone"]);
  });

  it("calibrates confidence as part of tidying", () => {
    expect(tidyPreferences(base, 10).confidence).toBe(0.25);
  });
});
