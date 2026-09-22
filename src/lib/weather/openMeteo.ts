import { z } from "zod";

import type { WeatherConditions } from "@/lib/rules/weather";

/**
 * Open-Meteo: no API key, generous limits, and a geocoding endpoint for city
 * lookup. Results are cached per city per hour — the forecast does not change
 * faster than that, and a recommendation should not wait on a network call it
 * already made.
 */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface GeocodedPlace {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface Forecast extends WeatherConditions {
  place: string;
  /** ISO hour the reading applies to. */
  time: string;
  description: string;
  timezone: string;
}

const GeocodeSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        country: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

const ForecastSchema = z.object({
  timezone: z.string(),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()),
    relative_humidity_2m: z.array(z.number().nullable()),
    precipitation_probability: z.array(z.number().nullable()),
    wind_speed_10m: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()),
  }),
});

const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return hit.value as T;
}

function remember<T>(key: string, value: T): T {
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function geocodeCity(city: string): Promise<GeocodedPlace | null> {
  const key = `geo:${city.trim().toLowerCase()}`;
  const hit = cached<GeocodedPlace>(key);
  if (hit) return hit;

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`geocoding failed (${response.status})`);

  const parsed = GeocodeSchema.safeParse(await response.json());
  const first = parsed.success ? parsed.data.results?.[0] : undefined;
  if (!first) return null;

  return remember(key, {
    name: first.name,
    country: first.country ?? "",
    latitude: first.latitude,
    longitude: first.longitude,
    timezone: first.timezone ?? "auto",
  });
}

export interface ForecastQuery {
  latitude: number;
  longitude: number;
  place?: string;
  /** Which hour to report. Defaults to now. */
  when?: Date;
}

export async function getForecast(query: ForecastQuery): Promise<Forecast> {
  const target = query.when ?? new Date();
  const key = `fc:${query.latitude.toFixed(2)},${query.longitude.toFixed(2)}:${target.toISOString().slice(0, 13)}`;
  const hit = cached<Forecast>(key);
  if (hit) return hit;

  const url =
    `${FORECAST_URL}?latitude=${query.latitude}&longitude=${query.longitude}` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,weather_code` +
    `&forecast_days=3&timezone=auto`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`forecast failed (${response.status})`);

  const parsed = ForecastSchema.parse(await response.json());
  const index = nearestHourIndex(parsed.hourly.time, target);

  const forecast: Forecast = {
    place: query.place ?? "",
    time: parsed.hourly.time[index] ?? target.toISOString(),
    timezone: parsed.timezone,
    temperatureC: parsed.hourly.temperature_2m[index] ?? 20,
    humidity: parsed.hourly.relative_humidity_2m[index] ?? 50,
    precipitationChance: parsed.hourly.precipitation_probability[index] ?? 0,
    windKph: parsed.hourly.wind_speed_10m[index] ?? 0,
    description: describeCode(parsed.hourly.weather_code[index] ?? 0),
  };

  return remember(key, forecast);
}

export async function forecastForCity(
  city: string,
  when?: Date,
): Promise<Forecast | null> {
  const place = await geocodeCity(city);
  if (!place) return null;
  return getForecast({
    latitude: place.latitude,
    longitude: place.longitude,
    place: `${place.name}${place.country ? `, ${place.country}` : ""}`,
    when,
  });
}

/**
 * Open-Meteo returns local wall-clock times without an offset; comparing them
 * as naive strings is what the API intends.
 */
function nearestHourIndex(times: string[], target: Date): number {
  if (!times.length) return 0;
  const wanted = target.toISOString().slice(0, 13);
  const exact = times.findIndex((t) => t.slice(0, 13) === wanted);
  if (exact !== -1) return exact;

  const targetMs = target.getTime();
  let best = 0;
  let bestGap = Infinity;
  times.forEach((time, index) => {
    const gap = Math.abs(new Date(time).getTime() - targetMs);
    if (gap < bestGap) {
      bestGap = gap;
      best = index;
    }
  });
  return best;
}

/** WMO weather codes, collapsed to what a person would say. */
export function describeCode(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code <= 48) return "foggy";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}
