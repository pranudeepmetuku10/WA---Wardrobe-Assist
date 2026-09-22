import type { GarmentColor, Pattern } from "@/lib/garments/attributes";

/**
 * Colour reasoning for outfit scoring.
 *
 * Deliberately conservative: the job is to reject genuinely bad pairings, not
 * to enforce a colour theory textbook. Most real wardrobes are mostly neutral,
 * and neutrals go with everything — so the interesting cases are the few
 * saturated items and how they sit together.
 */

export interface Hsl {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = 60 * (((g - b) / delta) % 6);
  else if (max === g) h = 60 * ((b - r) / delta + 2);
  else h = 60 * ((r - g) / delta + 4);

  return { h: (h + 360) % 360, s, l };
}

/**
 * Neutrals coordinate with anything. White, black, grey, beige and denim-navy
 * are the backbone of most wardrobes, so detecting them well matters more than
 * any harmony rule.
 */
export function isNeutral(hex: string): boolean {
  const { s, l } = hexToHsl(hex);
  if (l >= 0.92 || l <= 0.12) return true; // near-white / near-black
  if (s <= 0.12) return true; // greys
  // Muted earth tones (beige, stone, khaki, camel): low saturation, mid-light.
  if (s <= 0.3 && l >= 0.55) return true;
  // Navy and charcoal: low-ish saturation, dark.
  if (s <= 0.45 && l <= 0.28) return true;
  return false;
}

/** Shortest distance between two hues, 0-180. */
export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export type HarmonyKind =
  | "neutral"
  | "monochrome"
  | "analogous"
  | "complementary"
  | "triadic"
  | "clash";

export function classifyPair(hexA: string, hexB: string): HarmonyKind {
  if (isNeutral(hexA) || isNeutral(hexB)) return "neutral";

  const a = hexToHsl(hexA);
  const b = hexToHsl(hexB);
  const distance = hueDistance(a.h, b.h);

  if (distance <= 15) return "monochrome";
  if (distance <= 45) return "analogous";
  if (distance >= 150) return "complementary";
  if (distance >= 100 && distance < 150) return "triadic";
  // 45-100 degrees apart: close enough to look like a mistake, far enough to
  // avoid reading as intentional.
  return "clash";
}

const PAIR_SCORES: Record<HarmonyKind, number> = {
  neutral: 0.9,
  monochrome: 0.85,
  analogous: 0.8,
  complementary: 0.75,
  triadic: 0.55,
  clash: 0.2,
};

/** The colour a garment reads as from across a room. */
export function primaryHex(colors: readonly GarmentColor[]): string | null {
  if (!colors.length) return null;
  return (colors.find((c) => c.role === "primary") ?? colors[0]).hex;
}

export interface PatternedGarment {
  colors: GarmentColor[];
  pattern: Pattern;
}

/**
 * 0-1 harmony score for a whole outfit.
 *
 * Two loud patterns are penalised rather than banned, per the spec — it is a
 * bold choice, not an error, and the stylist model can still justify it.
 */
export function outfitColorScore(garments: readonly PatternedGarment[]): number {
  const hexes = garments
    .map((g) => primaryHex(g.colors))
    .filter((hex): hex is string => Boolean(hex));

  if (hexes.length < 2) return 0.7; // nothing to clash with

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < hexes.length; i += 1) {
    for (let j = i + 1; j < hexes.length; j += 1) {
      total += PAIR_SCORES[classifyPair(hexes[i], hexes[j])];
      pairs += 1;
    }
  }
  let score = total / pairs;

  // Too many saturated colours reads as busy however well they pair.
  const statementCount = hexes.filter((hex) => !isNeutral(hex)).length;
  if (statementCount >= 3) score -= 0.15;

  const loudPatterns = garments.filter(
    (g) => g.pattern !== "SOLID" && g.pattern !== "TEXTURED",
  ).length;
  if (loudPatterns >= 2) score -= 0.2 * (loudPatterns - 1);

  return clamp01(score);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
