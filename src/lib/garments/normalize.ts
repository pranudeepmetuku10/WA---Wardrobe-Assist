import {
  type ExtractedGarment,
  type GarmentColor,
  type Material,
  type Season,
} from "@/lib/garments/attributes";

/**
 * Deterministic clean-up of model output.
 *
 * Small local models are decent at naming a garment and hopeless at keeping
 * physical facts consistent — a linen blazer comes back as warmth 4, tagged
 * for winter. Stage A scores weather fit from `warmth` and `materials`, so a
 * wrong warmth is not cosmetic: it removes the right garment from a hot day.
 *
 * These rules encode what the fabric itself dictates, so they hold whichever
 * model produced the attributes.
 */

/** Inclusive [min, max] warmth a material can plausibly support. */
const WARMTH_BY_MATERIAL: Partial<Record<Material, [number, number]>> = {
  LINEN: [1, 2],
  CHIFFON: [1, 2],
  SILK: [1, 3],
  SATIN: [1, 3],
  RAYON: [1, 3],
  VISCOSE: [1, 3],
  COTTON: [1, 4],
  CANVAS: [2, 4],
  DENIM: [2, 4],
  LEATHER: [2, 5],
  SUEDE: [2, 5],
  KNIT: [2, 5],
  WOOL: [3, 5],
  CASHMERE: [3, 5],
  FLEECE: [3, 5],
  DOWN: [4, 5],
};

/** Materials that make a garment implausible in the hottest or coldest months. */
const HOT_WEATHER_MATERIALS: Material[] = ["LINEN", "CHIFFON"];
const COLD_WEATHER_MATERIALS: Material[] = ["WOOL", "CASHMERE", "FLEECE", "DOWN"];

/** Style vocabulary. Colours and fabrics are attributes, not styles. */
const STYLE_STOPWORDS = new Set<string>([
  "navy",
  "black",
  "white",
  "blue",
  "red",
  "green",
  "grey",
  "gray",
  "brown",
  "beige",
  "cream",
  "olive",
  "linen",
  "cotton",
  "denim",
  "wool",
  "silk",
  "leather",
  "blazer",
  "shirt",
  "trousers",
  "jacket",
  "dress",
  "shoes",
]);

export function clampWarmth(
  warmth: number,
  materials: readonly Material[],
): number {
  let low = 1;
  let high = 5;

  for (const material of materials) {
    const range = WARMTH_BY_MATERIAL[material];
    if (!range) continue;
    // The lightest material present sets the ceiling: a linen-cotton blend
    // breathes roughly like linen.
    low = Math.max(low, range[0]);
    high = Math.min(high, range[1]);
  }

  // Contradictory blend (e.g. linen + down): trust the range, not the order.
  if (low > high) [low, high] = [Math.min(low, high), Math.max(low, high)];

  return Math.min(Math.max(warmth, low), high);
}

export function normalizeSeasons(
  seasons: readonly Season[],
  materials: readonly Material[],
): Season[] {
  let unique = Array.from(new Set(seasons));

  // ALL_SEASON alongside specific seasons is a contradiction; the specifics win.
  if (unique.length > 1 && unique.includes("ALL_SEASON")) {
    unique = unique.filter((s) => s !== "ALL_SEASON");
  }

  if (materials.some((m) => HOT_WEATHER_MATERIALS.includes(m))) {
    unique = unique.filter((s) => s !== "WINTER");
    if (!unique.length) unique = ["SUMMER"];
  }
  if (materials.some((m) => COLD_WEATHER_MATERIALS.includes(m))) {
    unique = unique.filter((s) => s !== "SUMMER");
    if (!unique.length) unique = ["WINTER"];
  }

  return unique.length ? unique : ["ALL_SEASON"];
}

/** "BLAZER/JACKET" -> "blazer", "Oxford Shirt" -> "oxford shirt". */
export function normalizeSubcategory(value: string): string {
  const first = value.split(/[/|,]/)[0] ?? value;
  return first.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export function normalizeStyleTags(tags: readonly string[]): string[] {
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 1 && !STYLE_STOPWORDS.has(tag));
  return Array.from(new Set(cleaned)).slice(0, 5);
}

/** Exactly one primary colour, and no duplicate hexes. */
export function normalizeColors(colors: readonly GarmentColor[]): GarmentColor[] {
  const seen = new Set<string>();
  const unique = colors.filter((color) => {
    const key = color.hex.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!unique.length) return [];

  const primaryIndex = unique.findIndex((c) => c.role === "primary");
  return unique.map((color, index) => ({
    ...color,
    hex: color.hex.toLowerCase(),
    name: color.name.trim().toLowerCase(),
    role:
      index === (primaryIndex === -1 ? 0 : primaryIndex)
        ? ("primary" as const)
        : color.role === "primary"
          ? ("secondary" as const)
          : color.role,
  }));
}

/** Applies every rule above to one extracted item. */
export function normalizeExtractedGarment(
  item: ExtractedGarment,
): ExtractedGarment {
  const materials = item.materials;
  return {
    ...item,
    subcategory: normalizeSubcategory(item.subcategory),
    colors: normalizeColors(item.colors),
    styleTags: normalizeStyleTags(item.styleTags),
    warmth: item.warmth === null ? null : clampWarmth(item.warmth, materials),
    seasons: normalizeSeasons(item.seasons, materials),
  };
}
