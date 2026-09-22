import { describe, expect, it } from "vitest";

import { buildCombinations, type CombinableGarment } from "@/lib/rules/combine";
import {
  filterGarments,
  isWrongForWeather,
  seasonForDate,
  type CandidateGarment,
  type FilterContext,
} from "@/lib/rules/filter";
import { resolveOccasion } from "@/lib/rules/occasions";
import type { WeatherConditions } from "@/lib/rules/weather";

const NOW = new Date("2026-07-15T18:00:00Z");

const HOT: WeatherConditions = {
  temperatureC: 32,
  humidity: 75,
  precipitationChance: 5,
};

function garment(over: Partial<CandidateGarment> = {}): CandidateGarment {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    category: "TOP",
    subcategory: "shirt",
    formality: 3,
    warmth: 2,
    materials: ["COTTON"],
    seasons: ["ALL_SEASON"],
    styleTags: [],
    status: "AVAILABLE",
    isBasic: false,
    lastWornAt: null,
    isFavorite: false,
    ...over,
  };
}

function context(over: Partial<FilterContext> = {}): FilterContext {
  return {
    occasion: resolveOccasion("date night"),
    weather: HOT,
    season: "SUMMER",
    recencyDays: 7,
    now: NOW,
    ...over,
  };
}

describe("filterGarments", () => {
  it("drops anything not available", () => {
    const result = filterGarments(
      [garment({ status: "IN_LAUNDRY" }), garment({ status: "RETIRED" })],
      context(),
    );
    expect(result.kept).toHaveLength(0);
    expect(result.rejected.get("unavailable")).toBe(2);
  });

  it("drops out-of-season items but keeps ALL_SEASON", () => {
    const result = filterGarments(
      [
        garment({ id: "winter", seasons: ["WINTER"] }),
        garment({ id: "any", seasons: ["ALL_SEASON"] }),
        garment({ id: "summer", seasons: ["SUMMER"] }),
      ],
      context(),
    );
    expect(result.kept.map((k) => k.garment.id).sort()).toEqual(["any", "summer"]);
  });

  it("enforces the occasion's formality window", () => {
    // Interview is [4,5]: gym shorts must not survive.
    const result = filterGarments(
      [
        garment({ id: "shorts", formality: 1 }),
        garment({ id: "suit", formality: 5 }),
      ],
      context({ occasion: resolveOccasion("interview") }),
    );
    expect(result.kept.map((k) => k.garment.id)).toEqual(["suit"]);
    expect(result.rejected.get("too_casual")).toBe(1);
  });

  it("hides recently worn items but never basics", () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 86_400_000);
    const result = filterGarments(
      [
        garment({ id: "shirt", lastWornAt: threeDaysAgo }),
        garment({ id: "jeans", lastWornAt: threeDaysAgo, isBasic: true }),
        garment({ id: "old", lastWornAt: new Date(NOW.getTime() - 20 * 86_400_000) }),
      ],
      context(),
    );
    expect(result.kept.map((k) => k.garment.id).sort()).toEqual(["jeans", "old"]);
    expect(result.rejected.get("worn_recently")).toBe(1);
  });

  it("brings recently worn items back when recency is relaxed", () => {
    const yesterday = new Date(NOW.getTime() - 86_400_000);
    const result = filterGarments(
      [garment({ id: "shirt", lastWornAt: yesterday })],
      context({ relaxed: ["recency"] }),
    );
    expect(result.kept).toHaveLength(1);
  });

  it("widens the formality window by one step when relaxed", () => {
    const smartCasual = garment({ id: "smart", formality: 3 });
    const strict = filterGarments([smartCasual], context({
      occasion: resolveOccasion("interview"),
    }));
    const relaxed = filterGarments([smartCasual], context({
      occasion: resolveOccasion("interview"),
      relaxed: ["formality"],
    }));
    expect(strict.kept).toHaveLength(0);
    expect(relaxed.kept).toHaveLength(1);
  });

  it("ranks the better weather fit first", () => {
    const result = filterGarments(
      [
        garment({ id: "wool", warmth: 5, materials: ["WOOL"] }),
        garment({ id: "linen", warmth: 1, materials: ["LINEN"] }),
      ],
      context(),
    );
    expect(result.kept[0].garment.id).toBe("linen");
  });
});

describe("weather veto", () => {
  it("vetoes wool trousers at 32C — the failure seen in a live run", () => {
    const woolTrousers = garment({
      id: "khakis",
      category: "BOTTOM",
      warmth: 3,
      materials: ["WOOL"],
    });
    const result = filterGarments([woolTrousers], context());
    expect(result.kept).toHaveLength(0);
    expect(result.rejected.get("wrong_for_weather")).toBe(1);
  });

  it("keeps light garments in the heat", () => {
    const linenShirt = garment({ warmth: 1, materials: ["LINEN"] });
    const chinos = garment({ warmth: 2, materials: ["COTTON"] });
    expect(isWrongForWeather(linenShirt, HOT)).toBe(false);
    expect(isWrongForWeather(chinos, HOT)).toBe(false);
  });

  it("vetoes a summer shirt in freezing weather", () => {
    const freezing = { temperatureC: 1, humidity: 70, precipitationChance: 20 };
    expect(isWrongForWeather({ warmth: 1 }, freezing)).toBe(true);
    expect(isWrongForWeather({ warmth: 5 }, freezing)).toBe(false);
  });

  it("ignores the outside temperature indoors", () => {
    expect(isWrongForWeather({ warmth: 4 }, { ...HOT, indoor: true })).toBe(false);
  });

  it("does nothing in mild weather", () => {
    const mild = { temperatureC: 20, humidity: 50, precipitationChance: 0 };
    expect(isWrongForWeather({ warmth: 1 }, mild)).toBe(false);
    expect(isWrongForWeather({ warmth: 5 }, mild)).toBe(false);
  });

  it("is not undone by the relaxation ladder", () => {
    const woolTrousers = garment({ warmth: 5, materials: ["WOOL"] });
    const relaxed = filterGarments(
      [woolTrousers],
      context({ relaxed: ["recency", "formality", "season"] }),
    );
    // Relaxing constraints must never produce a physically wrong suggestion.
    expect(relaxed.kept).toHaveLength(0);
  });
});

describe("seasonForDate", () => {
  it("maps months to seasons", () => {
    expect(seasonForDate(new Date("2026-01-10"))).toBe("WINTER");
    expect(seasonForDate(new Date("2026-04-10"))).toBe("SPRING");
    expect(seasonForDate(new Date("2026-07-10"))).toBe("SUMMER");
    expect(seasonForDate(new Date("2026-10-10"))).toBe("AUTUMN");
  });

  it("honours monsoon when the location has one", () => {
    expect(seasonForDate(new Date("2026-07-10"), true)).toBe("MONSOON");
  });
});

// ---------------------------------------------------------------- combine ---

function combinable(
  id: string,
  category: string,
  hex: string,
  over: Partial<CandidateGarment> = {},
): CombinableGarment {
  const base = garment({ id, category: category as CandidateGarment["category"], ...over });
  return {
    garment: base,
    weatherFit: 0.8,
    formalityFit: 0.8,
    styleFit: 0.7,
    score: 0.78,
    colors: [{ name: "c", hex, role: "primary" }],
    pattern: "SOLID",
  };
}

describe("buildCombinations", () => {
  const wardrobe = [
    combinable("top1", "TOP", "#6b7245"),
    combinable("top2", "TOP", "#f5f3ef"),
    combinable("bottom1", "BOTTOM", "#cfc3ae"),
    combinable("bottom2", "BOTTOM", "#3b4a68"),
    combinable("shoes1", "FOOTWEAR", "#6f4a2f"),
  ];

  it("produces complete outfits only", () => {
    const { combinations } = buildCombinations(wardrobe, { weather: HOT });
    expect(combinations.length).toBeGreaterThan(0);
    for (const combination of combinations) {
      expect(combination.slots.footwear).toBeDefined();
      const hasBase =
        Boolean(combination.slots.one_piece) ||
        (Boolean(combination.slots.top) && Boolean(combination.slots.bottom));
      expect(hasBase).toBe(true);
    }
  });

  it("never pairs a one-piece with a bottom", () => {
    const withDress = [
      ...wardrobe,
      combinable("dress1", "ONE_PIECE", "#1b2631"),
    ];
    const { combinations } = buildCombinations(withDress, { weather: HOT });
    for (const combination of combinations) {
      if (combination.slots.one_piece) {
        expect(combination.slots.bottom).toBeUndefined();
        expect(combination.slots.top).toBeUndefined();
      }
    }
  });

  it("omits outerwear in dry heat and requires it in the cold", () => {
    const withCoat = [...wardrobe, combinable("coat", "OUTERWEAR", "#1b2631")];

    const hot = buildCombinations(withCoat, { weather: HOT });
    expect(hot.combinations.every((c) => !c.slots.outerwear)).toBe(true);

    const cold = buildCombinations(withCoat, {
      weather: { temperatureC: 3, humidity: 60, precipitationChance: 10 },
    });
    expect(cold.combinations.every((c) => Boolean(c.slots.outerwear))).toBe(true);
  });

  it("reports missing slots instead of half an outfit", () => {
    const noShoes = wardrobe.filter((g) => g.garment.category !== "FOOTWEAR");
    const result = buildCombinations(noShoes, { weather: HOT });
    expect(result.combinations).toHaveLength(0);
    expect(result.missingSlots).toContain("footwear");
  });

  it("caps the candidate list", () => {
    const many = [
      ...Array.from({ length: 12 }, (_, i) => combinable(`t${i}`, "TOP", "#6b7245")),
      ...Array.from({ length: 12 }, (_, i) => combinable(`b${i}`, "BOTTOM", "#cfc3ae")),
      ...Array.from({ length: 6 }, (_, i) => combinable(`s${i}`, "FOOTWEAR", "#6f4a2f")),
    ];
    const result = buildCombinations(many, { weather: HOT, limit: 40 });
    expect(result.generated).toBeGreaterThan(40);
    expect(result.combinations).toHaveLength(40);
  });

  it("never puts a necktie on a t-shirt", () => {
    // Seen in a live run: the tie was attached after scoring, so nothing
    // checked whether it belonged.
    const withTie = [
      combinable("tee", "TOP", "#f5f3ef", { formality: 2, subcategory: "crew neck t-shirt" }),
      combinable("jeans", "BOTTOM", "#3b4a68", { formality: 2 }),
      combinable("sneakers", "FOOTWEAR", "#f2f0ec", { formality: 2 }),
      combinable("tie", "ACCESSORY", "#d40001", { formality: 4, subcategory: "red tie" }),
    ];
    const { combinations } = buildCombinations(withTie, { weather: HOT });
    for (const combination of combinations) {
      expect(combination.garmentIds).not.toContain("tie");
    }
  });

  it("does allow a tie with a formal collared shirt", () => {
    const formal = [
      combinable("shirt", "TOP", "#ffffff", { formality: 4, subcategory: "dress shirt" }),
      combinable("trousers", "BOTTOM", "#1b2631", { formality: 4 }),
      combinable("oxfords", "FOOTWEAR", "#36454f", { formality: 4 }),
      combinable("tie", "ACCESSORY", "#d40001", { formality: 4, subcategory: "silk tie" }),
    ];
    const { combinations } = buildCombinations(formal, { weather: HOT });
    expect(combinations.some((c) => c.garmentIds.includes("tie"))).toBe(true);
  });

  it("ranks harmonious outfits above clashing ones", () => {
    const clashy = [
      combinable("topA", "TOP", "#d21919"),
      combinable("bottomA", "BOTTOM", "#b8b81e"),
      combinable("topB", "TOP", "#cfc3ae"),
      combinable("bottomB", "BOTTOM", "#6b7245"),
      combinable("shoes", "FOOTWEAR", "#6f4a2f"),
    ];
    const { combinations } = buildCombinations(clashy, { weather: HOT });
    const best = combinations[0];
    expect(best.garmentIds).not.toEqual(
      expect.arrayContaining(["topA", "bottomA"]),
    );
  });
});
