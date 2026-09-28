import type { Category } from "@/lib/garments/attributes";
import { OCCASIONS } from "@/lib/rules/occasions";

/**
 * Wardrobe insights. Pure functions over plain rows so they can be tested
 * without a database — and so the numbers are arithmetic, not model output.
 */

export interface InsightGarment {
  id: string;
  subcategory: string;
  category: Category;
  formality: number;
  status: string;
  wearCount: number;
  lastWornAt: Date | null;
  createdAt: Date;
  priceCents: number | null;
  isFavorite: boolean;
}

export interface WornRanking {
  id: string;
  subcategory: string;
  wearCount: number;
  lastWornAt: Date | null;
}

export function mostWorn(
  garments: readonly InsightGarment[],
  limit = 5,
): WornRanking[] {
  return [...garments]
    .filter((g) => g.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount)
    .slice(0, limit)
    .map(toRanking);
}

export function leastWorn(
  garments: readonly InsightGarment[],
  limit = 5,
): WornRanking[] {
  return [...garments]
    .filter((g) => g.status !== "RETIRED")
    .sort((a, b) => a.wearCount - b.wearCount)
    .slice(0, limit)
    .map(toRanking);
}

function toRanking(g: InsightGarment): WornRanking {
  return {
    id: g.id,
    subcategory: g.subcategory,
    wearCount: g.wearCount,
    lastWornAt: g.lastWornAt,
  };
}

export interface CostPerWear {
  id: string;
  subcategory: string;
  priceCents: number;
  wearCount: number;
  /** Cents per wear. An unworn item costs its full price per wear. */
  centsPerWear: number;
}

export function costPerWear(garments: readonly InsightGarment[]): CostPerWear[] {
  return garments
    .filter((g): g is InsightGarment & { priceCents: number } =>
      typeof g.priceCents === "number" && g.priceCents > 0,
    )
    .map((g) => ({
      id: g.id,
      subcategory: g.subcategory,
      priceCents: g.priceCents,
      wearCount: g.wearCount,
      centsPerWear: Math.round(g.priceCents / Math.max(1, g.wearCount)),
    }))
    .sort((a, b) => b.centsPerWear - a.centsPerWear);
}

export interface RetireCandidate {
  id: string;
  subcategory: string;
  reason: string;
  daysOwned: number;
}

/**
 * Things worth letting go of: owned a long time, never worn, and not a
 * favourite. Favourites are exempt — sentiment is a legitimate reason to keep
 * a garment, and the app should not argue with it.
 */
export function retireCandidates(
  garments: readonly InsightGarment[],
  now: Date,
  minDaysOwned = 180,
): RetireCandidate[] {
  return garments
    .filter((g) => {
      if (g.isFavorite || g.status === "RETIRED") return false;
      const days = daysBetween(g.createdAt, now);
      if (days < minDaysOwned) return false;
      if (g.wearCount === 0) return true;
      // Worn once, long ago, and not since.
      return (
        g.wearCount <= 1 &&
        g.lastWornAt !== null &&
        daysBetween(g.lastWornAt, now) > minDaysOwned
      );
    })
    .map((g) => ({
      id: g.id,
      subcategory: g.subcategory,
      daysOwned: Math.round(daysBetween(g.createdAt, now)),
      reason:
        g.wearCount === 0
          ? "never worn"
          : `worn once, not since ${g.lastWornAt?.toDateString() ?? "a while"}`,
    }))
    .sort((a, b) => b.daysOwned - a.daysOwned);
}

export interface OccasionCoverage {
  occasion: string;
  label: string;
  /** Can a complete outfit be built for this occasion at all? */
  covered: boolean;
  missing: string[];
}

/**
 * Which occasions the wardrobe cannot dress, and what is missing.
 *
 * Only formality and availability are considered — this is a standing view of
 * the wardrobe, not a recommendation for today, so weather is deliberately
 * out of scope.
 */
export function occasionCoverage(
  garments: readonly InsightGarment[],
): OccasionCoverage[] {
  const available = garments.filter((g) => g.status === "AVAILABLE");

  return OCCASIONS.map((occasion) => {
    const inRange = available.filter(
      (g) =>
        g.formality >= occasion.formality[0] &&
        g.formality <= occasion.formality[1],
    );

    const has = (category: Category) =>
      inRange.some((g) => g.category === category);

    const missing: string[] = [];
    if (!has("FOOTWEAR")) missing.push("shoes");
    if (!has("ONE_PIECE")) {
      if (!has("TOP")) missing.push("a top");
      if (!has("BOTTOM")) missing.push("bottoms");
    }

    return {
      occasion: occasion.id,
      label: occasion.label,
      covered: missing.length === 0,
      missing,
    };
  });
}

export interface WardrobeSummary {
  total: number;
  available: number;
  inLaundry: number;
  neverWorn: number;
  totalWears: number;
  valueCents: number;
}

export function summarize(garments: readonly InsightGarment[]): WardrobeSummary {
  return {
    total: garments.length,
    available: garments.filter((g) => g.status === "AVAILABLE").length,
    inLaundry: garments.filter((g) => g.status === "IN_LAUNDRY").length,
    neverWorn: garments.filter((g) => g.wearCount === 0).length,
    totalWears: garments.reduce((sum, g) => sum + g.wearCount, 0),
    valueCents: garments.reduce((sum, g) => sum + (g.priceCents ?? 0), 0),
  };
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
