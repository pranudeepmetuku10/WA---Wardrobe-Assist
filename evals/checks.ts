/**
 * Deterministic rule checks.
 *
 * These are the non-negotiables — the things that make a suggestion wrong
 * rather than merely unfashionable. They are plain assertions, not model
 * judgements, so a regression here is unambiguous.
 */

export interface TestGarment {
  id: string;
  subcategory: string;
  category: string;
  formality: number;
  warmth: number;
  materials: string[];
  status: string;
}

export interface TestOutfit {
  title: string;
  reasoning: string;
  garments: TestGarment[];
}

export interface CheckContext {
  occasion: string;
  formalityWindow: [number, number];
  temperatureC: number;
  precipitationChance: number;
  relaxed: string[];
  knownIds: Set<string>;
}

/** Returns null when the outfit passes, or a sentence explaining the failure. */
export type CheckFn = (outfit: TestOutfit, ctx: CheckContext) => string | null;

export interface Check {
  id: string;
  describe: string;
  run: CheckFn;
}

const WOOL_LIKE = ["WOOL", "CASHMERE", "FLEECE", "DOWN"];

export const UNIVERSAL_CHECKS: Check[] = [
  {
    id: "real_ids",
    describe: "every garment exists in the wardrobe",
    run: (outfit, ctx) => {
      const unknown = outfit.garments
        .filter((g) => !ctx.knownIds.has(g.id))
        .map((g) => g.id);
      return unknown.length ? `invented garment ids: ${unknown.join(", ")}` : null;
    },
  },
  {
    id: "complete_outfit",
    describe: "has footwear plus either a one-piece or a top and bottom",
    run: (outfit) => {
      const has = (category: string) =>
        outfit.garments.some((g) => g.category === category);
      if (!has("FOOTWEAR")) return "no footwear";
      if (has("ONE_PIECE")) return null;
      if (!has("TOP")) return "no top";
      if (!has("BOTTOM")) return "no bottom";
      return null;
    },
  },
  {
    id: "no_one_piece_with_bottom",
    describe: "never pairs a dress or saree with trousers",
    run: (outfit) => {
      const hasOnePiece = outfit.garments.some((g) => g.category === "ONE_PIECE");
      const hasBottom = outfit.garments.some((g) => g.category === "BOTTOM");
      return hasOnePiece && hasBottom
        ? "a one-piece was paired with a separate bottom"
        : null;
    },
  },
  {
    id: "available_only",
    describe: "nothing in the laundry",
    run: (outfit) => {
      const unavailable = outfit.garments.filter((g) => g.status !== "AVAILABLE");
      return unavailable.length
        ? `unavailable items suggested: ${unavailable.map((g) => g.subcategory).join(", ")}`
        : null;
    },
  },
  {
    id: "footwear_formality",
    describe: "footwear formality within one step of the top",
    run: (outfit) => {
      const shoes = outfit.garments.find((g) => g.category === "FOOTWEAR");
      const upper = outfit.garments.find(
        (g) => g.category === "TOP" || g.category === "ONE_PIECE",
      );
      if (!shoes || !upper) return null;
      const gap = Math.abs(shoes.formality - upper.formality);
      return gap > 1
        ? `${shoes.subcategory} (${shoes.formality}) with ${upper.subcategory} (${upper.formality})`
        : null;
    },
  },
  {
    id: "no_wool_in_heat",
    describe: "no wool, fleece or down above 28C",
    run: (outfit, ctx) => {
      if (ctx.temperatureC < 28) return null;
      const offenders = outfit.garments.filter((g) =>
        g.materials.some((m) => WOOL_LIKE.includes(m)),
      );
      return offenders.length
        ? `${offenders.map((g) => g.subcategory).join(", ")} at ${ctx.temperatureC}C`
        : null;
    },
  },
  {
    id: "no_heavy_layers_in_heat",
    describe: "no outerwear above 27C in dry weather",
    run: (outfit, ctx) => {
      if (ctx.temperatureC < 27 || ctx.precipitationChance >= 50) return null;
      const layers = outfit.garments.filter((g) => g.category === "OUTERWEAR");
      return layers.length
        ? `${layers.map((g) => g.subcategory).join(", ")} at ${ctx.temperatureC}C`
        : null;
    },
  },
  {
    id: "layer_when_cold",
    describe: "includes outerwear at or below 12C",
    run: (outfit, ctx) => {
      if (ctx.temperatureC > 12) return null;
      const hasLayer = outfit.garments.some((g) => g.category === "OUTERWEAR");
      return hasLayer ? null : `no layer at ${ctx.temperatureC}C`;
    },
  },
  {
    id: "nothing_too_thin_when_freezing",
    describe: "nothing rated warmth 1 below 5C",
    run: (outfit, ctx) => {
      if (ctx.temperatureC > 5) return null;
      const thin = outfit.garments.filter(
        (g) => g.warmth === 1 && g.category !== "ACCESSORY" && g.category !== "BAG",
      );
      return thin.length
        ? `${thin.map((g) => g.subcategory).join(", ")} at ${ctx.temperatureC}C`
        : null;
    },
  },
  {
    id: "formality_window",
    describe: "garments sit inside the occasion's formality window",
    run: (outfit, ctx) => {
      // The pipeline is allowed to widen the window by one step, and says so.
      const slack = ctx.relaxed.includes("formality") ? 1 : 0;
      const [min, max] = ctx.formalityWindow;
      const offenders = outfit.garments.filter(
        (g) =>
          g.category !== "ACCESSORY" &&
          g.category !== "BAG" &&
          (g.formality < min - slack || g.formality > max + slack),
      );
      return offenders.length
        ? `${offenders
            .map((g) => `${g.subcategory} (${g.formality})`)
            .join(", ")} outside ${min}-${max}`
        : null;
    },
  },
  {
    id: "reasoning_is_specific",
    describe: "reasoning refers to the actual conditions",
    run: (outfit, ctx) => {
      const text = outfit.reasoning.toLowerCase();
      if (text.length < 40) return "reasoning is too short to be specific";
      const mentionsWeather =
        /\d+\s*°?c\b/.test(text) ||
        /(humid|heat|hot|cold|chilly|warm|rain|wet|breath|sweat|layer|freez)/.test(
          text,
        );
      const mentionsOccasion = ctx.occasion
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 3 && text.includes(word));
      if (!mentionsWeather && !mentionsOccasion) {
        return "reasoning mentions neither the weather nor the occasion";
      }
      return null;
    },
  },
];

/** Build a check that fails if any garment matches a pattern. */
export function forbid(
  id: string,
  pattern: RegExp,
  why: string,
): Check {
  return {
    id,
    describe: why,
    run: (outfit) => {
      const offenders = outfit.garments.filter((g) => pattern.test(g.subcategory));
      return offenders.length
        ? `${offenders.map((g) => g.subcategory).join(", ")} — ${why}`
        : null;
    },
  };
}

/** Build a check that fails unless some garment matches a pattern. */
export function require_(
  id: string,
  pattern: RegExp,
  why: string,
): Check {
  return {
    id,
    describe: why,
    run: (outfit) =>
      outfit.garments.some((g) => pattern.test(g.subcategory))
        ? null
        : `nothing matching ${pattern} — ${why}`,
  };
}

/** Build a check that fails if any garment carries a forbidden material. */
export function forbidMaterial(
  id: string,
  materials: string[],
  why: string,
): Check {
  return {
    id,
    describe: why,
    run: (outfit) => {
      const offenders = outfit.garments.filter((g) =>
        g.materials.some((m) => materials.includes(m)),
      );
      return offenders.length
        ? `${offenders.map((g) => g.subcategory).join(", ")} — ${why}`
        : null;
    },
  };
}
