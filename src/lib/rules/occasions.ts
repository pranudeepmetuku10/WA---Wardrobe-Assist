/**
 * Occasion configuration — edit this file to change how the app reads an
 * occasion. Nothing here is inferred by a model.
 *
 * `formality` is the acceptable window [min, max] on the 1-5 garment scale;
 * `ideal` is where the sweet spot sits inside it.
 */

export interface OccasionRule {
  id: string;
  label: string;
  formality: [number, number];
  ideal: number;
  /** Categories that must appear for the outfit to count as complete. */
  requires?: ("OUTERWEAR" | "BAG" | "HEADWEAR")[];
  /** Style tags to favour, and ones to avoid, when scoring candidates. */
  favourTags?: string[];
  avoidTags?: string[];
  /** Hint passed to the stylist model — tone, not rules. */
  note?: string;
}

export const OCCASIONS: OccasionRule[] = [
  {
    id: "work",
    label: "Work",
    formality: [3, 4],
    ideal: 3,
    favourTags: ["business", "classic", "minimal"],
    avoidTags: ["sporty", "festive"],
    note: "Office-appropriate. Comfortable enough to sit in all day.",
  },
  {
    id: "casual",
    label: "Casual",
    formality: [1, 3],
    ideal: 2,
    favourTags: ["minimal", "streetwear", "classic"],
    note: "Everyday. Comfort leads.",
  },
  {
    id: "date_night",
    label: "Date Night",
    formality: [3, 5],
    ideal: 4,
    favourTags: ["classic", "minimal", "edgy"],
    avoidTags: ["sporty"],
    note: "A step above everyday. One considered detail beats five.",
  },
  {
    id: "family_outing",
    label: "Family Outing",
    formality: [2, 3],
    ideal: 2,
    favourTags: ["classic", "minimal"],
    note: "Relaxed but put together. Likely to involve photographs.",
  },
  {
    id: "festive",
    label: "Festive / Wedding",
    formality: [4, 5],
    ideal: 4,
    favourTags: ["festive", "ethnic", "classic"],
    avoidTags: ["sporty", "streetwear"],
    note: "Celebration dressing. Cultural pieces are welcome and often ideal.",
  },
  {
    id: "travel",
    label: "Travel",
    formality: [1, 3],
    ideal: 2,
    favourTags: ["minimal", "classic"],
    avoidTags: ["festive"],
    note: "Airports are cold, journeys are long. Layers and comfort win.",
  },
  {
    id: "gym",
    label: "Gym",
    formality: [1, 2],
    ideal: 1,
    favourTags: ["sporty"],
    avoidTags: ["business", "festive", "ethnic"],
    note: "Movement and breathability only.",
  },
  {
    id: "interview",
    label: "Interview",
    formality: [4, 5],
    ideal: 4,
    favourTags: ["business", "classic", "minimal"],
    avoidTags: ["streetwear", "sporty", "festive"],
    note: "Conservative. Nothing that pulls focus from the person.",
  },
];

const BY_ID = new Map(OCCASIONS.map((o) => [o.id, o]));

/** Fallback for free-text occasions the user types themselves. */
export const DEFAULT_OCCASION: OccasionRule = {
  id: "custom",
  label: "Custom",
  formality: [2, 4],
  ideal: 3,
  note: "Interpret the occasion from the user's own words.",
};

/**
 * Resolves a chip id, or a free-text phrase, to a rule. Matching is keyword
 * based and deliberately simple — if nothing matches we widen the window
 * rather than guess a narrow one.
 */
export function resolveOccasion(input: string): OccasionRule {
  const key = input.trim().toLowerCase();
  const direct = BY_ID.get(key.replace(/\s+/g, "_"));
  if (direct) return direct;

  const keywords: Array<[RegExp, string]> = [
    [/\b(office|work|client|meeting|presentation|desk)\b/, "work"],
    [/\b(interview|viva|defen[cs]e)\b/, "interview"],
    [/\b(wedding|sangeet|mehendi|diwali|puja|festival|reception|party)\b/, "festive"],
    [/\b(date|dinner|drinks|anniversary)\b/, "date_night"],
    [/\b(gym|workout|run|training|yoga)\b/, "gym"],
    [/\b(flight|airport|travel|train|road trip)\b/, "travel"],
    [/\b(family|lunch|brunch|outing|market|errand)\b/, "family_outing"],
    [/\b(casual|chill|home|relax|weekend)\b/, "casual"],
  ];

  for (const [pattern, id] of keywords) {
    if (pattern.test(key)) return BY_ID.get(id) ?? DEFAULT_OCCASION;
  }

  return { ...DEFAULT_OCCASION, label: input.trim() || "Custom" };
}
