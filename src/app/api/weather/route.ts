import { forecastForCity, geocodeCity } from "@/lib/weather/openMeteo";

/** GET /api/weather?city=Boston — used by the Today screen to prefill. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city");
  if (!city) {
    return Response.json({ ok: false, error: "city is required" }, { status: 400 });
  }

  const when = params.get("when") ? new Date(params.get("when")!) : undefined;

  try {
    const place = await geocodeCity(city);
    if (!place) {
      return Response.json(
        { ok: false, error: `couldn't find "${city}"` },
        { status: 404 },
      );
    }
    const forecast = await forecastForCity(city, when);
    return Response.json({ ok: true, place, forecast });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
