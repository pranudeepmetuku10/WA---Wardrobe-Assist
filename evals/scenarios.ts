import { forbid, forbidMaterial, require_, type Check } from "./checks";

/**
 * 25 scenarios: occasion x weather x constraint.
 *
 * Each carries the deterministic rules a good answer must satisfy, plus a
 * rubric in plain English for the judge. The rubric describes what a good
 * answer looks like — not what to say.
 */

export interface Scenario {
  id: string;
  occasion: string;
  weather: {
    temperatureC: number;
    humidity: number;
    precipitationChance?: number;
    windKph?: number;
  };
  timeOfDay?: string;
  indoorOutdoor?: "indoor" | "outdoor" | "mixed";
  userRequest?: string;
  /** Applied to the fixture wardrobe before the run, then undone. */
  setup?: {
    inLaundry?: string[];
    wornDaysAgo?: Array<{ id: string; days: number }>;
  };
  /** Extra rules on top of the universal ones. */
  checks?: Check[];
  /** Expect no viable outfit — the wardrobe genuinely cannot do this. */
  expectNoOutfit?: boolean;
  rubric: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "hot-humid-date-night",
    occasion: "date night",
    weather: { temperatureC: 34, humidity: 80, precipitationChance: 5 },
    timeOfDay: "evening",
    checks: [forbidMaterial("no-heavy-fabric", ["WOOL", "DOWN", "FLEECE"], "too warm for 34C")],
    rubric:
      "Should favour linen or other breathable fabrics, stay smart enough for dinner, and say why the fabric suits 34C and 80% humidity.",
  },
  {
    id: "office-summer",
    occasion: "work",
    weather: { temperatureC: 29, humidity: 55 },
    timeOfDay: "morning",
    indoorOutdoor: "indoor",
    checks: [forbid("no-shorts-at-work", /shorts/i, "shorts are not office wear")],
    rubric:
      "Office-appropriate and comfortable in an air-conditioned building. No shorts, no gym wear.",
  },
  {
    id: "office-winter",
    occasion: "work",
    weather: { temperatureC: 2, humidity: 70, precipitationChance: 20 },
    timeOfDay: "morning",
    checks: [forbid("no-shorts-at-work", /shorts/i, "shorts are not office wear")],
    rubric:
      "Warm enough for 2C with a real coat, still smart enough for an office.",
  },
  {
    id: "interview-mild",
    occasion: "interview",
    weather: { temperatureC: 18, humidity: 50 },
    timeOfDay: "morning",
    checks: [
      forbid("no-sneakers-at-interview", /sneaker|running shoe|sandal/i, "too casual for an interview"),
      forbid("no-shorts-at-interview", /shorts/i, "too casual for an interview"),
    ],
    rubric:
      "Conservative and formal. Nothing that pulls focus. Leather shoes, tailored pieces.",
  },
  {
    id: "gym-session",
    occasion: "gym",
    weather: { temperatureC: 22, humidity: 60 },
    checks: [
      forbid("no-formal-shoes-at-gym", /oxford|loafer|jutti|heeled/i, "not gym footwear"),
      forbidMaterial("no-delicate-fabric-at-gym", ["SILK", "SATIN", "LINEN"], "not gym fabric"),
    ],
    rubric: "Breathable, movement-friendly. Trainers, not leather.",
  },
  {
    id: "wedding-festive",
    occasion: "festive wedding reception",
    weather: { temperatureC: 26, humidity: 65 },
    timeOfDay: "evening",
    rubric:
      "Celebration dressing at the top of the formality range. Cultural formalwear is ideal here, not a fallback.",
  },
  {
    id: "monsoon-commute",
    occasion: "work",
    weather: { temperatureC: 24, humidity: 92, precipitationChance: 90 },
    timeOfDay: "morning",
    indoorOutdoor: "mixed",
    checks: [forbid("no-suede-in-rain", /suede/i, "suede is ruined by rain")],
    rubric:
      "Should account for a 90% chance of rain — water-resistant footwear or a shell, and no suede.",
  },
  {
    id: "airport-travel-day",
    occasion: "travel",
    weather: { temperatureC: 15, humidity: 55 },
    timeOfDay: "morning",
    rubric:
      "Comfortable for hours of sitting, layered for a cold cabin, easy at security.",
  },
  {
    id: "family-lunch-warm",
    occasion: "family lunch",
    weather: { temperatureC: 27, humidity: 50 },
    timeOfDay: "afternoon",
    rubric: "Relaxed but photograph-ready. Nothing sloppy, nothing stiff.",
  },
  {
    id: "casual-weekend-cool",
    occasion: "casual",
    weather: { temperatureC: 12, humidity: 60 },
    rubric: "Everyday comfort with a layer for 12C.",
  },
  {
    id: "freezing-outdoors",
    occasion: "casual",
    weather: { temperatureC: -4, humidity: 75, windKph: 25 },
    indoorOutdoor: "outdoor",
    checks: [require_("needs-a-coat", /coat|puffer|jacket/i, "a real coat below freezing")],
    rubric: "Genuinely warm for -4C with wind. A jumper alone is not enough.",
  },
  {
    id: "date-night-cold",
    occasion: "date night",
    weather: { temperatureC: 6, humidity: 70 },
    timeOfDay: "evening",
    rubric: "Smart and warm. A coat that suits the outfit rather than fighting it.",
  },
  {
    id: "work-presentation",
    occasion: "client presentation",
    weather: { temperatureC: 20, humidity: 50 },
    timeOfDay: "morning",
    indoorOutdoor: "indoor",
    checks: [forbid("no-casual-shoes", /running shoe|sandal/i, "too casual to present in")],
    rubric: "The most polished end of workwear. Tailoring reads as competence here.",
  },
  {
    id: "festive-daytime-puja",
    occasion: "festival puja at home",
    weather: { temperatureC: 31, humidity: 70 },
    timeOfDay: "morning",
    rubric:
      "Traditional and comfortable in 31C. Cultural pieces suit this better than western formalwear.",
  },
  {
    id: "laundry-day",
    occasion: "work",
    weather: { temperatureC: 21, humidity: 55 },
    setup: {
      inLaundry: ["f-top-01", "f-top-02", "f-bot-01", "f-bot-02", "f-sho-01"],
    },
    rubric:
      "Most of the usual office kit is in the wash. Should work around it without complaint.",
  },
  {
    id: "recently-worn",
    occasion: "casual",
    weather: { temperatureC: 19, humidity: 55 },
    setup: {
      wornDaysAgo: [
        { id: "f-top-03", days: 1 },
        { id: "f-out-05", days: 2 },
      ],
    },
    rubric: "Should avoid repeating what was worn in the last couple of days.",
  },
  {
    id: "request-white-sneakers",
    occasion: "casual",
    weather: { temperatureC: 23, humidity: 50 },
    userRequest: "something with the white sneakers",
    checks: [require_("honours-request", /white leather sneakers/i, "the user asked for these")],
    rubric: "Must actually include the white sneakers the person asked for.",
  },
  {
    id: "request-dressier",
    occasion: "dinner with friends",
    weather: { temperatureC: 17, humidity: 60 },
    userRequest: "dressier than usual please",
    rubric: "Should read the request and lean formal within what the occasion allows.",
  },
  {
    id: "beach-holiday",
    occasion: "beach day",
    weather: { temperatureC: 33, humidity: 70 },
    indoorOutdoor: "outdoor",
    checks: [forbidMaterial("nothing-heavy", ["WOOL", "DOWN", "FLEECE", "LEATHER"], "wrong for a beach at 33C")],
    rubric: "Light, breathable, sun-appropriate. Sandals over closed leather shoes.",
  },
  {
    id: "rainy-casual",
    occasion: "casual",
    weather: { temperatureC: 14, humidity: 88, precipitationChance: 85 },
    checks: [forbid("no-suede-in-rain", /suede/i, "suede is ruined by rain")],
    rubric: "Rain-ready without being dressed for a storm. No suede.",
  },
  {
    id: "smart-casual-evening",
    occasion: "drinks after work",
    weather: { temperatureC: 19, humidity: 55 },
    timeOfDay: "evening",
    rubric: "A step down from office, a step up from weekend.",
  },
  {
    id: "hot-office-no-ac",
    occasion: "work",
    weather: { temperatureC: 33, humidity: 75 },
    indoorOutdoor: "outdoor",
    checks: [
      forbidMaterial("no-wool-in-heat", ["WOOL", "DOWN", "FLEECE"], "33C with no air conditioning"),
      forbid("no-shorts-at-work", /shorts/i, "shorts are not office wear"),
    ],
    rubric:
      "The hard case: office-appropriate at 33C and humid. Linen is the answer, not a wool suit.",
  },
  {
    id: "windy-autumn-walk",
    occasion: "family outing",
    weather: { temperatureC: 11, humidity: 65, windKph: 40 },
    indoorOutdoor: "outdoor",
    checks: [require_("windproof-layer", /jacket|coat|shell|puffer/i, "40kph wind needs a layer")],
    rubric: "A layer that actually blocks wind at 40kph.",
  },
  {
    id: "black-tie-gap",
    occasion: "black tie gala",
    weather: { temperatureC: 16, humidity: 55 },
    timeOfDay: "evening",
    rubric:
      "This wardrobe has no black tie. The honest answer names what is missing rather than dressing it up as formalwear.",
  },
  {
    id: "everything-in-laundry",
    occasion: "interview",
    weather: { temperatureC: 20, humidity: 55 },
    setup: {
      inLaundry: [
        "f-sho-01", "f-sho-02", "f-sho-03", "f-sho-04", "f-sho-05",
        "f-sho-06", "f-sho-07", "f-sho-08", "f-sho-09",
      ],
    },
    expectNoOutfit: true,
    rubric:
      "Every pair of shoes is in the wash. The only honest answer is that no outfit can be built.",
  },
];
