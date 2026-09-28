import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { FIXTURE_USER_ID, FIXTURE_WARDROBE } from "./fixtures/wardrobe";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Loads the fixture wardrobe under its own user id, so evals never read or
 * write the real wardrobe. Safe to re-run.
 */
export async function seedFixtures(): Promise<number> {
  for (const item of FIXTURE_WARDROBE) {
    const { id, colors, ...rest } = item;
    await prisma.garment.upsert({
      where: { id },
      create: {
        id,
        userId: FIXTURE_USER_ID,
        userVerified: true,
        colors: colors as never,
        ...rest,
      } as never,
      // Reset state between runs: nothing in the laundry, nothing worn.
      update: {
        status: "AVAILABLE",
        lastWornAt: null,
        wearCount: 0,
        colors: colors as never,
        ...rest,
      } as never,
    });
  }

  await prisma.styleProfile.upsert({
    where: { userId: FIXTURE_USER_ID },
    create: {
      userId: FIXTURE_USER_ID,
      homeCity: null,
      colorsLoved: ["navy", "olive"],
      colorsToAvoid: [],
      neverPair: [{ a: "brown shoes", b: "black trousers" }],
      wearRecencyDays: 7,
    },
    update: {},
  });

  return FIXTURE_WARDROBE.length;
}

/** Clears outfits the harness generated, leaving the wardrobe in place. */
export async function clearFixtureOutfits(): Promise<void> {
  await prisma.outfit.deleteMany({ where: { userId: FIXTURE_USER_ID } });
}

export { prisma, FIXTURE_USER_ID };

if (process.argv[1]?.endsWith("seed.ts")) {
  seedFixtures()
    .then((count) => console.log(`seeded ${count} fixture garments`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
