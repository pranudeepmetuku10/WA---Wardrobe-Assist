import { StyleProfileForm, type ProfileView } from "@/components/StyleProfileForm";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export default async function ProfilePage() {
  const profile = await prisma.styleProfile.upsert({
    where: { userId: env.DEFAULT_USER_ID },
    create: { userId: env.DEFAULT_USER_ID },
    update: {},
  });

  const view: ProfileView = {
    homeCity: profile.homeCity,
    bodyNotes: profile.bodyNotes,
    colorsLoved: profile.colorsLoved,
    colorsToAvoid: profile.colorsToAvoid,
    neverPair: (profile.neverPair ?? []) as unknown as Array<{ a: string; b: string }>,
    dressCodeNotes: profile.dressCodeNotes,
    freeformPreferences: profile.freeformPreferences,
    learnedPreferences: profile.learnedPreferences,
    learnedPreferencesUpdated:
      profile.learnedPreferencesUpdated?.toISOString() ?? null,
    wearRecencyDays: profile.wearRecencyDays,
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Style
        </h1>
        <p className="mt-1 text-sm text-muted">
          What the app should know about how you dress.
        </p>
      </header>

      <StyleProfileForm initial={view} />
    </main>
  );
}
