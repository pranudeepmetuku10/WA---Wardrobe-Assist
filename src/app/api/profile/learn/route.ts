import { refreshLearnedPreferences } from "@/lib/ai/learn";

/** POST /api/profile/learn — the "refresh my profile" button. */
export async function POST(request: Request) {
  // Only the eval harness passes a user; the app always uses the default.
  const userId =
    process.env.NODE_ENV === "production"
      ? undefined
      : (new URL(request.url).searchParams.get("userId") ?? undefined);

  try {
    const outcome = await refreshLearnedPreferences(userId);
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
