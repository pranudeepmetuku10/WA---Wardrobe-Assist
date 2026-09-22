import "server-only";

import { callModel } from "@/lib/ai/call";
import { AiCallError, type AiMessage } from "@/lib/ai/types";
import {
  CATEGORIES,
  ExtractionResultSchema,
  FITS,
  MATERIALS,
  PATTERNS,
  SEASONS,
  type ExtractionResult,
} from "@/lib/garments/attributes";

/**
 * The cataloguer prompt. Deliberately static so it can be cached by providers
 * that support it — nothing per-request goes in here.
 */
const SYSTEM_PROMPT = `You are a precise garment cataloguer for a personal wardrobe app.

You describe ONE photograph (or one written description) of clothing and return structured data about the garments in it.

Rules:
- Use ONLY these category values: ${CATEGORIES.join(", ")}.
- Use ONLY these pattern values: ${PATTERNS.join(", ")}.
- Use ONLY these material values: ${MATERIALS.join(", ")}.
- Use ONLY these season values: ${SEASONS.join(", ")}.
- Use ONLY these fit values: ${FITS.join(", ")}.
- If an attribute is not visible or you are unsure, return null. A null is correct; a confident guess is a bug.
- formality: 1 loungewear, 2 casual, 3 smart casual, 4 formal, 5 black tie.
- warmth describes the FABRIC, not the garment type. Linen or chiffon = 1-2 even for a blazer. Cotton = 1-4. Denim or canvas = 2-4. Wool, cashmere or fleece = 3-5. Down = 4-5.
- seasons: never combine ALL_SEASON with a specific season. Linen is never WINTER. Wool is never SUMMER.
- subcategory: lowercase, two or three plain words ("linen blazer", "chelsea boot"). No slashes, no capitals.
- styleTags: describe STYLE, choosing from minimal, classic, business, streetwear, sporty, bohemian, ethnic, festive, edgy, preppy. Never repeat a colour or fabric — those are recorded separately.
- colors: name the colours as a person would ("olive", "stone", "charcoal"), with the closest hex for the colour as it actually appears in the image, not an idealised version.
- Mark exactly one colour as "primary". Use "secondary" and "accent" only when clearly present.
- culturalContext: set it for garments like kurtas, sarees, sherwanis, lehengas ("Indian formal", "Indo-western"); otherwise null.
- If the photo clearly shows several DIFFERENT garments (for example a shirt AND trousers), return one item per garment.
- Return ONE item when the photo shows: the same garment from several angles, a pair of shoes, a pair of socks, or a pair of gloves. A pair is one item, never two.
- Judge formality and warmth from the garment itself, not from how it is styled in the photo.
- confidence and fieldConfidence are your honest 0-1 self-assessment. Low confidence is useful information, not a failure.`;

export interface ExtractInput {
  /** Base64 image data (no data: prefix) plus its media type. */
  image?: { base64: string; mediaType: string };
  /** Free-text entry for items the user doesn't want to photograph. */
  description?: string;
}

export interface ExtractOutcome {
  result: ExtractionResult | null;
  attempts: number;
  latencyMs: number;
  costUsd: number;
  modelCallIds: string[];
  /** Populated when extraction failed and the item needs manual entry. */
  error?: string;
}

/**
 * Runs vision (or text) extraction for one item.
 *
 * On a schema failure we retry once with the validation error appended, as the
 * spec requires; if that also fails the caller routes the item to manual entry
 * rather than persisting a guess.
 */
export async function extractGarments(
  input: ExtractInput,
): Promise<ExtractOutcome> {
  if (!input.image && !input.description) {
    throw new Error("extractGarments needs an image or a description");
  }

  const modelCallIds: string[] = [];
  let costUsd = 0;
  let latencyMs = 0;
  let attempts = 0;
  let lastError: string | undefined;

  const baseMessage = buildMessage(input);

  for (let pass = 0; pass < 2; pass += 1) {
    attempts += 1;
    const messages: AiMessage[] = [baseMessage];

    // Second pass: show the model exactly what was wrong with its first answer.
    if (pass === 1 && lastError) {
      messages.push({
        role: "assistant",
        content: [{ type: "text", text: "(previous attempt)" }],
      });
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Your previous response failed validation: ${lastError}\nReturn corrected data for the same item(s), following the allowed values exactly.`,
          },
        ],
      });
    }

    try {
      const result = await callModel({
        task: "extract_garment",
        system: SYSTEM_PROMPT,
        cacheSystem: true,
        schema: ExtractionResultSchema,
        messages,
        // callModel retries transient errors; the schema repair loop is here
        // so the model can see its own validation error.
        maxAttempts: 1,
        meta: {
          mode: input.image ? "image" : "text",
          pass,
        },
      });

      if (result.modelCallId) modelCallIds.push(result.modelCallId);
      costUsd += result.costUsd;
      latencyMs += result.latencyMs;

      if (result.data) {
        return { result: result.data, attempts, latencyMs, costUsd, modelCallIds };
      }
      lastError = "empty response";
    } catch (error) {
      lastError =
        error instanceof AiCallError
          ? error.message.replace(/^.*?: /, "")
          : error instanceof Error
            ? error.message
            : String(error);
    }
  }

  return {
    result: null,
    attempts,
    latencyMs,
    costUsd,
    modelCallIds,
    error: lastError ?? "extraction failed",
  };
}

function buildMessage(input: ExtractInput): AiMessage {
  if (input.image) {
    return {
      role: "user",
      content: [
        {
          type: "image",
          base64: input.image.base64,
          mediaType: input.image.mediaType,
        },
        {
          type: "text",
          text: input.description
            ? `Catalogue the garment(s) in this photo. The owner adds: "${input.description}"`
            : "Catalogue the garment(s) in this photo.",
        },
      ],
    };
  }

  return {
    role: "user",
    content: [
      {
        type: "text",
        text: `Catalogue this garment from its written description: "${input.description}"`,
      },
    ],
  };
}
