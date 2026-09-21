import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

const USER_ID = process.env.DEFAULT_USER_ID ?? "local-user";

/**
 * Seeds the single-user style profile plus a few garments, enough to prove the
 * schema round-trips (enum arrays, Json colors) before ingestion exists.
 * The ~60-item fixture wardrobe for evals is seeded separately in Phase 4.
 */
async function main() {
  const profile = await prisma.styleProfile.upsert({
    where: { userId: USER_ID },
    create: {
      userId: USER_ID,
      colorsLoved: [],
      colorsToAvoid: [],
      neverPair: [],
      wearRecencyDays: Number(process.env.WEAR_RECENCY_DAYS ?? 7),
    },
    update: {},
  });
  console.log(`style profile ready for user "${USER_ID}" (${profile.id})`);

  const starters = [
    {
      id: "seed-olive-linen-shirt",
      category: "TOP",
      subcategory: "linen shirt",
      colors: [{ name: "olive", hex: "#6b7245", role: "primary" }],
      pattern: "SOLID",
      materials: ["LINEN"],
      formality: 3,
      warmth: 1,
      seasons: ["SUMMER", "MONSOON"],
      fit: "REGULAR",
      styleTags: ["minimal", "smart casual"],
    },
    {
      id: "seed-stone-chinos",
      category: "BOTTOM",
      subcategory: "chinos",
      colors: [{ name: "stone", hex: "#cfc3ae", role: "primary" }],
      pattern: "SOLID",
      materials: ["COTTON"],
      formality: 3,
      warmth: 2,
      seasons: ["ALL_SEASON"],
      fit: "SLIM",
      styleTags: ["minimal", "business casual"],
    },
    {
      id: "seed-brown-loafers",
      category: "FOOTWEAR",
      subcategory: "leather loafers",
      colors: [{ name: "brown", hex: "#6f4a2f", role: "primary" }],
      pattern: "SOLID",
      materials: ["LEATHER"],
      formality: 4,
      warmth: 2,
      seasons: ["ALL_SEASON"],
      fit: "REGULAR",
      styleTags: ["smart casual"],
    },
    {
      id: "seed-white-tee",
      category: "TOP",
      subcategory: "crew neck t-shirt",
      colors: [{ name: "white", hex: "#f5f3ef", role: "primary" }],
      pattern: "SOLID",
      materials: ["COTTON"],
      formality: 2,
      warmth: 1,
      seasons: ["SUMMER", "ALL_SEASON"],
      fit: "REGULAR",
      styleTags: ["minimal"],
      isBasic: true,
    },
    {
      id: "seed-indigo-jeans",
      category: "BOTTOM",
      subcategory: "straight jeans",
      colors: [{ name: "indigo", hex: "#3b4a68", role: "primary" }],
      pattern: "SOLID",
      materials: ["DENIM", "COTTON"],
      formality: 2,
      warmth: 3,
      seasons: ["ALL_SEASON"],
      fit: "REGULAR",
      styleTags: ["casual"],
      isBasic: true,
    },
    {
      id: "seed-white-sneakers",
      category: "FOOTWEAR",
      subcategory: "leather sneakers",
      colors: [{ name: "white", hex: "#f2f0ec", role: "primary" }],
      pattern: "SOLID",
      materials: ["LEATHER"],
      formality: 2,
      warmth: 2,
      seasons: ["ALL_SEASON"],
      fit: "REGULAR",
      styleTags: ["casual", "minimal"],
      isBasic: true,
    },
  ] as const;

  for (const item of starters) {
    const { id, ...rest } = item;
    await prisma.garment.upsert({
      where: { id },
      create: {
        id,
        userId: USER_ID,
        userVerified: true,
        ...rest,
      } as never,
      update: {},
    });
  }
  console.log(`${starters.length} starter garments ready`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
