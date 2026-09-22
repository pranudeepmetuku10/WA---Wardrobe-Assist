import { z } from "zod";

/**
 * The garment attribute contract, shared by extraction, the review screen and
 * the API. These arrays must stay in step with the enums in schema.prisma —
 * the model is given exactly these values and may not invent others.
 */

export const CATEGORIES = [
  "TOP",
  "BOTTOM",
  "ONE_PIECE",
  "OUTERWEAR",
  "FOOTWEAR",
  "ACCESSORY",
  "BAG",
  "JEWELRY",
  "HEADWEAR",
] as const;

export const PATTERNS = [
  "SOLID",
  "STRIPED",
  "CHECKED",
  "PRINTED",
  "TEXTURED",
  "EMBROIDERED",
] as const;

export const MATERIALS = [
  "COTTON",
  "LINEN",
  "DENIM",
  "WOOL",
  "CASHMERE",
  "SILK",
  "SATIN",
  "CHIFFON",
  "VELVET",
  "LEATHER",
  "SUEDE",
  "SYNTHETIC",
  "POLYESTER",
  "NYLON",
  "RAYON",
  "VISCOSE",
  "KNIT",
  "FLEECE",
  "DOWN",
  "RUBBER",
  "CANVAS",
  "BLEND",
  "OTHER",
] as const;

export const SEASONS = [
  "SPRING",
  "SUMMER",
  "MONSOON",
  "AUTUMN",
  "WINTER",
  "ALL_SEASON",
] as const;

export const FITS = ["SLIM", "REGULAR", "RELAXED", "OVERSIZED"] as const;

export const COLOR_ROLES = ["primary", "secondary", "accent"] as const;

export const GARMENT_STATUSES = [
  "AVAILABLE",
  "IN_LAUNDRY",
  "DRY_CLEAN",
  "STORED",
  "RETIRED",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Material = (typeof MATERIALS)[number];
export type Season = (typeof SEASONS)[number];
export type Fit = (typeof FITS)[number];
export type GarmentStatus = (typeof GARMENT_STATUSES)[number];

export const ColorSchema = z.object({
  name: z.string().describe("Plain colour name, e.g. olive, stone, indigo"),
  hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "hex must look like #rrggbb")
    .describe("Closest hex value for the colour as it appears"),
  role: z.enum(COLOR_ROLES),
});
export type GarmentColor = z.infer<typeof ColorSchema>;

/**
 * Per-field confidence. A fixed key set rather than an open map, because a
 * grammar-constrained local model handles a known shape far more reliably.
 */
export const FieldConfidenceSchema = z.object({
  category: z.number().min(0).max(1),
  colors: z.number().min(0).max(1),
  materials: z.number().min(0).max(1),
  formality: z.number().min(0).max(1),
});
export type FieldConfidence = z.infer<typeof FieldConfidenceSchema>;

/**
 * What the model returns per garment. Anything not visible in the photo comes
 * back null — a wrong guess is worse than a blank the user fills in.
 */
export const ExtractedGarmentSchema = z.object({
  category: z.enum(CATEGORIES),
  subcategory: z
    .string()
    .describe('Specific item name, e.g. "oxford shirt", "kurta", "chelsea boot"'),
  colors: z.array(ColorSchema).min(1).max(4),
  pattern: z.enum(PATTERNS).nullable(),
  materials: z.array(z.enum(MATERIALS)).max(4),
  formality: z
    .number()
    .int()
    .min(1)
    .max(5)
    .nullable()
    .describe("1 loungewear, 2 casual, 3 smart casual, 4 formal, 5 black tie"),
  warmth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .nullable()
    .describe("1 sheer/linen, 3 mid-weight, 5 heavy wool"),
  seasons: z.array(z.enum(SEASONS)).max(6),
  fit: z.enum(FITS).nullable(),
  styleTags: z
    .array(z.string())
    .max(5)
    .describe('e.g. "minimal", "streetwear", "ethnic", "business", "festive"'),
  culturalContext: z
    .string()
    .nullable()
    .describe('e.g. "Indian formal", "Indo-western", or null if not applicable'),
  confidence: z.number().min(0).max(1).describe("Overall confidence 0-1"),
  fieldConfidence: FieldConfidenceSchema,
});
export type ExtractedGarment = z.infer<typeof ExtractedGarmentSchema>;

/** A photo may contain several items; the user confirms the split. */
export const ExtractionResultSchema = z.object({
  items: z.array(ExtractedGarmentSchema).min(1).max(6),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** Editable subset used by the review screen and PATCH endpoint. */
export const GarmentEditSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  subcategory: z.string().min(1).max(80).optional(),
  colors: z.array(ColorSchema).min(1).max(4).optional(),
  pattern: z.enum(PATTERNS).optional(),
  materials: z.array(z.enum(MATERIALS)).max(4).optional(),
  formality: z.number().int().min(1).max(5).optional(),
  warmth: z.number().int().min(1).max(5).optional(),
  seasons: z.array(z.enum(SEASONS)).max(6).optional(),
  fit: z.enum(FITS).optional(),
  styleTags: z.array(z.string()).max(8).optional(),
  culturalContext: z.string().max(80).nullable().optional(),
  brand: z.string().max(60).nullable().optional(),
  notes: z.string().max(400).nullable().optional(),
  isFavorite: z.boolean().optional(),
  isBasic: z.boolean().optional(),
  status: z.enum(GARMENT_STATUSES).optional(),
});
export type GarmentEdit = z.infer<typeof GarmentEditSchema>;

/** Defaults applied when the model returns null for a field. */
export const FALLBACKS = {
  pattern: "SOLID",
  formality: 3,
  warmth: 2,
  fit: "REGULAR",
  seasons: ["ALL_SEASON"],
} as const;
