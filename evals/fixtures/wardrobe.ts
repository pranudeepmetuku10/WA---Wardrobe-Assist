/**
 * A fixture wardrobe of 60 garments, deliberately shaped like a real one:
 * mostly neutral, a few statement pieces, some cultural formalwear, a gym
 * drawer, and genuine gaps (no black tie, thin winter coverage) so scenarios
 * can test the "your wardrobe lacks X" path.
 *
 * No images — extraction is not what the eval measures.
 */

export interface FixtureGarment {
  id: string;
  category:
    | "TOP"
    | "BOTTOM"
    | "ONE_PIECE"
    | "OUTERWEAR"
    | "FOOTWEAR"
    | "ACCESSORY"
    | "BAG"
    | "JEWELRY"
    | "HEADWEAR";
  subcategory: string;
  colors: Array<{ name: string; hex: string; role: "primary" | "secondary" | "accent" }>;
  pattern: "SOLID" | "STRIPED" | "CHECKED" | "PRINTED" | "TEXTURED" | "EMBROIDERED";
  materials: string[];
  formality: number;
  warmth: number;
  seasons: string[];
  fit: "SLIM" | "REGULAR" | "RELAXED" | "OVERSIZED";
  styleTags: string[];
  culturalContext?: string;
  isBasic?: boolean;
  priceCents?: number;
}

const c = (name: string, hex: string, role: "primary" | "secondary" | "accent" = "primary") => ({
  name,
  hex,
  role,
});

export const FIXTURE_WARDROBE: FixtureGarment[] = [
  // ---------------------------------------------------------------- tops --
  { id: "f-top-01", category: "TOP", subcategory: "white oxford shirt", colors: [c("white", "#f7f5f0")], pattern: "SOLID", materials: ["COTTON"], formality: 4, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["business", "classic"], priceCents: 6500 },
  { id: "f-top-02", category: "TOP", subcategory: "light blue oxford shirt", colors: [c("light blue", "#b9cfe3")], pattern: "SOLID", materials: ["COTTON"], formality: 4, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["business", "classic"], priceCents: 6500 },
  { id: "f-top-03", category: "TOP", subcategory: "olive linen shirt", colors: [c("olive", "#6b7245")], pattern: "SOLID", materials: ["LINEN"], formality: 3, warmth: 1, seasons: ["SUMMER", "MONSOON"], fit: "REGULAR", styleTags: ["minimal"], priceCents: 5500 },
  { id: "f-top-04", category: "TOP", subcategory: "white linen shirt", colors: [c("white", "#f5f2ea")], pattern: "SOLID", materials: ["LINEN"], formality: 3, warmth: 1, seasons: ["SUMMER", "MONSOON"], fit: "RELAXED", styleTags: ["minimal"], priceCents: 5900 },
  { id: "f-top-05", category: "TOP", subcategory: "white crew neck t-shirt", colors: [c("white", "#f5f3ef")], pattern: "SOLID", materials: ["COTTON"], formality: 2, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["minimal"], isBasic: true, priceCents: 1800 },
  { id: "f-top-06", category: "TOP", subcategory: "black crew neck t-shirt", colors: [c("black", "#1a1a1a")], pattern: "SOLID", materials: ["COTTON"], formality: 2, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["minimal"], isBasic: true, priceCents: 1800 },
  { id: "f-top-07", category: "TOP", subcategory: "navy polo shirt", colors: [c("navy", "#1b2631")], pattern: "SOLID", materials: ["COTTON", "KNIT"], formality: 3, warmth: 2, seasons: ["SPRING", "SUMMER"], fit: "REGULAR", styleTags: ["classic", "preppy"], priceCents: 4500 },
  { id: "f-top-08", category: "TOP", subcategory: "striped breton tee", colors: [c("navy", "#243b53"), c("white", "#f3f1ec", "secondary")], pattern: "STRIPED", materials: ["COTTON"], formality: 2, warmth: 2, seasons: ["SPRING", "AUTUMN"], fit: "REGULAR", styleTags: ["classic"], priceCents: 3200 },
  { id: "f-top-09", category: "TOP", subcategory: "grey marl sweatshirt", colors: [c("grey", "#9a9a97")], pattern: "SOLID", materials: ["COTTON", "FLEECE"], formality: 1, warmth: 3, seasons: ["AUTUMN", "WINTER"], fit: "RELAXED", styleTags: ["sporty"], priceCents: 4000 },
  { id: "f-top-10", category: "TOP", subcategory: "charcoal merino jumper", colors: [c("charcoal", "#3a3a3d")], pattern: "SOLID", materials: ["WOOL"], formality: 3, warmth: 4, seasons: ["AUTUMN", "WINTER"], fit: "SLIM", styleTags: ["classic", "minimal"], priceCents: 9500 },
  { id: "f-top-11", category: "TOP", subcategory: "cream cable knit jumper", colors: [c("cream", "#e8e0cf")], pattern: "TEXTURED", materials: ["WOOL", "KNIT"], formality: 2, warmth: 5, seasons: ["WINTER"], fit: "RELAXED", styleTags: ["classic"], priceCents: 11000 },
  { id: "f-top-12", category: "TOP", subcategory: "black silk blouse", colors: [c("black", "#151515")], pattern: "SOLID", materials: ["SILK"], formality: 4, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["classic", "edgy"], priceCents: 8800 },
  { id: "f-top-13", category: "TOP", subcategory: "rust check flannel shirt", colors: [c("rust", "#9c4722"), c("charcoal", "#3d3d3d", "secondary")], pattern: "CHECKED", materials: ["COTTON"], formality: 2, warmth: 3, seasons: ["AUTUMN", "WINTER"], fit: "RELAXED", styleTags: ["streetwear"], priceCents: 4800 },
  { id: "f-top-14", category: "TOP", subcategory: "white kurta", colors: [c("white", "#f8f6f0")], pattern: "SOLID", materials: ["COTTON"], formality: 3, warmth: 1, seasons: ["SUMMER", "MONSOON"], fit: "RELAXED", styleTags: ["ethnic"], culturalContext: "Indian casual", priceCents: 3500 },
  { id: "f-top-15", category: "TOP", subcategory: "gold embroidered kurta", colors: [c("ivory", "#efe6d2"), c("gold", "#c9a227", "accent")], pattern: "EMBROIDERED", materials: ["SILK"], formality: 5, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["festive", "ethnic"], culturalContext: "Indian formal", priceCents: 22000 },
  { id: "f-top-16", category: "TOP", subcategory: "sports vest", colors: [c("black", "#1c1c1c")], pattern: "SOLID", materials: ["POLYESTER"], formality: 1, warmth: 1, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["sporty"], isBasic: true, priceCents: 2200 },
  { id: "f-top-17", category: "TOP", subcategory: "running tee", colors: [c("slate", "#525b68")], pattern: "SOLID", materials: ["POLYESTER"], formality: 1, warmth: 1, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["sporty"], isBasic: true, priceCents: 2800 },

  // ------------------------------------------------------------- bottoms --
  { id: "f-bot-01", category: "BOTTOM", subcategory: "stone chinos", colors: [c("stone", "#cfc3ae")], pattern: "SOLID", materials: ["COTTON"], formality: 3, warmth: 2, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["classic", "business"], priceCents: 6000 },
  { id: "f-bot-02", category: "BOTTOM", subcategory: "navy chinos", colors: [c("navy", "#28354a")], pattern: "SOLID", materials: ["COTTON"], formality: 3, warmth: 2, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["classic", "business"], priceCents: 6000 },
  { id: "f-bot-03", category: "BOTTOM", subcategory: "indigo straight jeans", colors: [c("indigo", "#3b4a68")], pattern: "SOLID", materials: ["DENIM"], formality: 2, warmth: 3, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["classic"], isBasic: true, priceCents: 7000 },
  { id: "f-bot-04", category: "BOTTOM", subcategory: "black slim jeans", colors: [c("black", "#202020")], pattern: "SOLID", materials: ["DENIM"], formality: 2, warmth: 3, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["minimal", "edgy"], isBasic: true, priceCents: 7000 },
  { id: "f-bot-05", category: "BOTTOM", subcategory: "charcoal wool trousers", colors: [c("charcoal", "#36383d")], pattern: "SOLID", materials: ["WOOL"], formality: 5, warmth: 4, seasons: ["AUTUMN", "WINTER"], fit: "SLIM", styleTags: ["business", "classic"], priceCents: 12000 },
  { id: "f-bot-06", category: "BOTTOM", subcategory: "navy suit trousers", colors: [c("navy", "#1f2a3c")], pattern: "SOLID", materials: ["WOOL", "BLEND"], formality: 5, warmth: 3, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["business"], priceCents: 14000 },
  { id: "f-bot-07", category: "BOTTOM", subcategory: "beige linen trousers", colors: [c("beige", "#d6c8ac")], pattern: "SOLID", materials: ["LINEN"], formality: 3, warmth: 1, seasons: ["SUMMER", "MONSOON"], fit: "RELAXED", styleTags: ["minimal"], priceCents: 6800 },
  { id: "f-bot-08", category: "BOTTOM", subcategory: "khaki shorts", colors: [c("khaki", "#c2b280")], pattern: "SOLID", materials: ["COTTON"], formality: 1, warmth: 1, seasons: ["SUMMER"], fit: "REGULAR", styleTags: ["casual"], priceCents: 3500 },
  { id: "f-bot-09", category: "BOTTOM", subcategory: "denim shorts", colors: [c("light denim", "#7f9ab5")], pattern: "SOLID", materials: ["DENIM"], formality: 1, warmth: 1, seasons: ["SUMMER"], fit: "REGULAR", styleTags: ["casual"], priceCents: 3800 },
  { id: "f-bot-10", category: "BOTTOM", subcategory: "running shorts", colors: [c("black", "#1c1c1c")], pattern: "SOLID", materials: ["POLYESTER"], formality: 1, warmth: 1, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["sporty"], isBasic: true, priceCents: 3000 },
  { id: "f-bot-11", category: "BOTTOM", subcategory: "grey joggers", colors: [c("grey", "#8e8e8b")], pattern: "SOLID", materials: ["COTTON", "FLEECE"], formality: 1, warmth: 3, seasons: ["AUTUMN", "WINTER"], fit: "RELAXED", styleTags: ["sporty"], priceCents: 4200 },
  { id: "f-bot-12", category: "BOTTOM", subcategory: "cream churidar", colors: [c("cream", "#efe7d6")], pattern: "SOLID", materials: ["COTTON", "SILK"], formality: 4, warmth: 2, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["ethnic", "festive"], culturalContext: "Indian formal", priceCents: 5000 },
  { id: "f-bot-13", category: "BOTTOM", subcategory: "black midi skirt", colors: [c("black", "#191919")], pattern: "SOLID", materials: ["VISCOSE"], formality: 4, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["classic", "minimal"], priceCents: 6200 },

  // ----------------------------------------------------------- one-piece --
  { id: "f-one-01", category: "ONE_PIECE", subcategory: "navy wrap dress", colors: [c("navy", "#22304a")], pattern: "SOLID", materials: ["VISCOSE"], formality: 4, warmth: 2, seasons: ["SPRING", "SUMMER", "AUTUMN"], fit: "REGULAR", styleTags: ["classic"], priceCents: 9800 },
  { id: "f-one-02", category: "ONE_PIECE", subcategory: "black slip dress", colors: [c("black", "#141414")], pattern: "SOLID", materials: ["SATIN"], formality: 4, warmth: 1, seasons: ["SUMMER"], fit: "SLIM", styleTags: ["edgy", "minimal"], priceCents: 8500 },
  { id: "f-one-03", category: "ONE_PIECE", subcategory: "floral cotton sundress", colors: [c("coral", "#e2725b"), c("cream", "#efe8d8", "secondary")], pattern: "PRINTED", materials: ["COTTON"], formality: 2, warmth: 1, seasons: ["SUMMER"], fit: "RELAXED", styleTags: ["bohemian"], priceCents: 5400 },
  { id: "f-one-04", category: "ONE_PIECE", subcategory: "teal silk saree", colors: [c("teal", "#0f6466"), c("gold", "#c9a227", "accent")], pattern: "EMBROIDERED", materials: ["SILK"], formality: 5, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["festive", "ethnic"], culturalContext: "Indian formal", priceCents: 28000 },
  { id: "f-one-05", category: "ONE_PIECE", subcategory: "grey jumpsuit", colors: [c("grey", "#77787a")], pattern: "SOLID", materials: ["COTTON", "BLEND"], formality: 3, warmth: 2, seasons: ["SPRING", "AUTUMN"], fit: "RELAXED", styleTags: ["minimal"], priceCents: 7600 },

  // ----------------------------------------------------------- outerwear --
  { id: "f-out-01", category: "OUTERWEAR", subcategory: "navy blazer", colors: [c("navy", "#1f2a3c")], pattern: "SOLID", materials: ["WOOL", "BLEND"], formality: 5, warmth: 3, seasons: ["ALL_SEASON"], fit: "SLIM", styleTags: ["business", "classic"], priceCents: 18000 },
  { id: "f-out-02", category: "OUTERWEAR", subcategory: "beige linen blazer", colors: [c("beige", "#d8cbb0")], pattern: "SOLID", materials: ["LINEN"], formality: 4, warmth: 1, seasons: ["SUMMER"], fit: "REGULAR", styleTags: ["minimal", "classic"], priceCents: 13000 },
  { id: "f-out-03", category: "OUTERWEAR", subcategory: "black leather jacket", colors: [c("black", "#161616")], pattern: "SOLID", materials: ["LEATHER"], formality: 3, warmth: 3, seasons: ["AUTUMN", "SPRING"], fit: "SLIM", styleTags: ["edgy", "streetwear"], priceCents: 24000 },
  { id: "f-out-04", category: "OUTERWEAR", subcategory: "charcoal wool overcoat", colors: [c("charcoal", "#34363a")], pattern: "SOLID", materials: ["WOOL"], formality: 4, warmth: 5, seasons: ["WINTER"], fit: "REGULAR", styleTags: ["classic"], priceCents: 26000 },
  { id: "f-out-05", category: "OUTERWEAR", subcategory: "olive field jacket", colors: [c("olive", "#5f6b41")], pattern: "SOLID", materials: ["CANVAS", "COTTON"], formality: 2, warmth: 3, seasons: ["AUTUMN", "SPRING"], fit: "REGULAR", styleTags: ["classic", "streetwear"], priceCents: 11000 },
  { id: "f-out-06", category: "OUTERWEAR", subcategory: "navy rain shell", colors: [c("navy", "#25334a")], pattern: "SOLID", materials: ["NYLON"], formality: 2, warmth: 2, seasons: ["MONSOON", "SPRING", "AUTUMN"], fit: "REGULAR", styleTags: ["sporty"], priceCents: 9000 },
  { id: "f-out-07", category: "OUTERWEAR", subcategory: "black puffer jacket", colors: [c("black", "#1b1b1b")], pattern: "SOLID", materials: ["DOWN", "NYLON"], formality: 2, warmth: 5, seasons: ["WINTER"], fit: "REGULAR", styleTags: ["sporty"], priceCents: 15000 },
  { id: "f-out-08", category: "OUTERWEAR", subcategory: "grey cardigan", colors: [c("grey", "#8b8b88")], pattern: "SOLID", materials: ["KNIT", "COTTON"], formality: 3, warmth: 3, seasons: ["AUTUMN", "SPRING"], fit: "REGULAR", styleTags: ["classic"], priceCents: 6800 },

  // ------------------------------------------------------------ footwear --
  { id: "f-sho-01", category: "FOOTWEAR", subcategory: "black oxford shoes", colors: [c("black", "#151515")], pattern: "SOLID", materials: ["LEATHER"], formality: 5, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["business", "classic"], priceCents: 16000 },
  { id: "f-sho-02", category: "FOOTWEAR", subcategory: "brown leather loafers", colors: [c("brown", "#6f4a2f")], pattern: "SOLID", materials: ["LEATHER"], formality: 4, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["classic"], priceCents: 13000 },
  { id: "f-sho-03", category: "FOOTWEAR", subcategory: "white leather sneakers", colors: [c("white", "#f2f0ec")], pattern: "SOLID", materials: ["LEATHER"], formality: 2, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["minimal"], isBasic: true, priceCents: 9000 },
  { id: "f-sho-04", category: "FOOTWEAR", subcategory: "running shoes", colors: [c("slate", "#4f5a66"), c("lime", "#b5e61d", "accent")], pattern: "SOLID", materials: ["SYNTHETIC"], formality: 1, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["sporty"], isBasic: true, priceCents: 11000 },
  { id: "f-sho-05", category: "FOOTWEAR", subcategory: "tan suede chelsea boots", colors: [c("tan", "#b08147")], pattern: "SOLID", materials: ["SUEDE"], formality: 3, warmth: 3, seasons: ["AUTUMN", "WINTER"], fit: "REGULAR", styleTags: ["classic"], priceCents: 17000 },
  { id: "f-sho-06", category: "FOOTWEAR", subcategory: "leather sandals", colors: [c("brown", "#7a5a3a")], pattern: "SOLID", materials: ["LEATHER"], formality: 2, warmth: 1, seasons: ["SUMMER", "MONSOON"], fit: "REGULAR", styleTags: ["casual"], priceCents: 4500 },
  { id: "f-sho-07", category: "FOOTWEAR", subcategory: "black heeled sandals", colors: [c("black", "#151515")], pattern: "SOLID", materials: ["LEATHER"], formality: 4, warmth: 1, seasons: ["SUMMER", "ALL_SEASON"], fit: "REGULAR", styleTags: ["classic"], priceCents: 12000 },
  { id: "f-sho-08", category: "FOOTWEAR", subcategory: "juttis", colors: [c("gold", "#c9a227")], pattern: "EMBROIDERED", materials: ["LEATHER"], formality: 4, warmth: 2, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["ethnic", "festive"], culturalContext: "Indian formal", priceCents: 6000 },
  { id: "f-sho-09", category: "FOOTWEAR", subcategory: "waterproof rain boots", colors: [c("black", "#1a1a1a")], pattern: "SOLID", materials: ["RUBBER"], formality: 1, warmth: 3, seasons: ["MONSOON", "WINTER"], fit: "REGULAR", styleTags: ["sporty"], priceCents: 7000 },

  // ----------------------------------------------------------- accessory --
  { id: "f-acc-01", category: "ACCESSORY", subcategory: "navy silk tie", colors: [c("navy", "#1f2a3c")], pattern: "SOLID", materials: ["SILK"], formality: 5, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["business"], priceCents: 5000 },
  { id: "f-acc-02", category: "ACCESSORY", subcategory: "brown leather belt", colors: [c("brown", "#6f4a2f")], pattern: "SOLID", materials: ["LEATHER"], formality: 3, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["classic"], isBasic: true, priceCents: 3500 },
  { id: "f-acc-03", category: "ACCESSORY", subcategory: "black leather belt", colors: [c("black", "#151515")], pattern: "SOLID", materials: ["LEATHER"], formality: 4, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["business"], isBasic: true, priceCents: 3500 },
  { id: "f-acc-04", category: "ACCESSORY", subcategory: "wool scarf", colors: [c("charcoal", "#3a3a3d")], pattern: "SOLID", materials: ["WOOL"], formality: 3, warmth: 5, seasons: ["WINTER"], fit: "REGULAR", styleTags: ["classic"], priceCents: 4500 },
  { id: "f-acc-05", category: "ACCESSORY", subcategory: "silk pocket square", colors: [c("burgundy", "#6d1f2c")], pattern: "PRINTED", materials: ["SILK"], formality: 5, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["business", "classic"], priceCents: 2500 },
  { id: "f-acc-06", category: "ACCESSORY", subcategory: "sunglasses", colors: [c("black", "#151515")], pattern: "SOLID", materials: ["SYNTHETIC"], formality: 2, warmth: 1, seasons: ["SUMMER", "SPRING"], fit: "REGULAR", styleTags: ["minimal"], priceCents: 8000 },

  // ---------------------------------------------------------------- bags --
  { id: "f-bag-01", category: "BAG", subcategory: "brown leather satchel", colors: [c("brown", "#6b4a30")], pattern: "SOLID", materials: ["LEATHER"], formality: 4, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["business", "classic"], priceCents: 19000 },
  { id: "f-bag-02", category: "BAG", subcategory: "canvas tote", colors: [c("natural", "#ddd3bd")], pattern: "SOLID", materials: ["CANVAS"], formality: 2, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["minimal"], isBasic: true, priceCents: 2500 },
  { id: "f-bag-03", category: "BAG", subcategory: "black clutch", colors: [c("black", "#141414")], pattern: "SOLID", materials: ["SATIN"], formality: 5, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["festive", "classic"], priceCents: 7500 },
  { id: "f-bag-04", category: "BAG", subcategory: "nylon backpack", colors: [c("charcoal", "#3b3b3e")], pattern: "SOLID", materials: ["NYLON"], formality: 1, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["sporty"], isBasic: true, priceCents: 6000 },

  // ------------------------------------------------------------ headwear --
  { id: "f-hat-01", category: "HEADWEAR", subcategory: "navy baseball cap", colors: [c("navy", "#25334a")], pattern: "SOLID", materials: ["COTTON"], formality: 1, warmth: 1, seasons: ["ALL_SEASON"], fit: "REGULAR", styleTags: ["sporty", "streetwear"], priceCents: 2200 },
  { id: "f-hat-02", category: "HEADWEAR", subcategory: "wool beanie", colors: [c("charcoal", "#38383b")], pattern: "SOLID", materials: ["WOOL", "KNIT"], formality: 1, warmth: 5, seasons: ["WINTER"], fit: "REGULAR", styleTags: ["casual"], priceCents: 2000 },
];

export const FIXTURE_USER_ID = "eval-fixture-user";
