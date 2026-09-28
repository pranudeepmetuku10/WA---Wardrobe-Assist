import { refreshLearnedPreferences } from "@/lib/ai/learn";

/** POST /api/profile/learn — the "refresh my profile" button. */
export async function POST() {
  try {
    const outcome = await refreshLearnedPreferences();
    return Response.json(
      {
        ok: Boolean(outcome.preferences),
        preferences: outcome.preferences,
        eventsConsidered: outcome.eventsConsidered,
        latencyMs: outcome.latencyMs,
        error: outcome.error,
      },
      { status: outcome.preferences ? 200 : 200 },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
