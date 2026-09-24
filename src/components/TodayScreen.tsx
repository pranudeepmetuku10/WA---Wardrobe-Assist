"use client";

import { useCallback, useState } from "react";

import { OutfitCard, type OutfitView } from "@/components/OutfitCard";

const OCCASIONS = [
  "Work",
  "Casual",
  "Date Night",
  "Family Outing",
  "Festive / Wedding",
  "Travel",
  "Gym",
  "Interview",
] as const;

interface WeatherView {
  temperatureC: number;
  humidity: number;
  precipitationChance: number;
  description: string;
  place?: string;
}

interface Props {
  initialCity: string | null;
  /** Fetched on the server so the first paint already has a forecast. */
  initialWeather: WeatherView | null;
}

export function TodayScreen({ initialCity, initialWeather }: Props) {
  const [city, setCity] = useState(initialCity ?? "");
  const [cityDraft, setCityDraft] = useState(initialCity ?? "");
  const [weather, setWeather] = useState<WeatherView | null>(initialWeather);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [editingWeather, setEditingWeather] = useState(false);

  const [occasion, setOccasion] = useState<string>("Casual");
  const [customOccasion, setCustomOccasion] = useState("");
  const [indoorOutdoor, setIndoorOutdoor] = useState<"indoor" | "outdoor" | "mixed">("mixed");
  const [request, setRequest] = useState("");

  const [loading, setLoading] = useState(false);
  const [outfits, setOutfits] = useState<OutfitView[]>([]);
  const [relaxed, setRelaxed] = useState<string[]>([]);
  const [gap, setGap] = useState<{ item: string; why: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No setState before the first await: doing so inside an effect cascades
  // renders. Every state change here happens once the fetch has resolved.
  const loadWeather = useCallback(async (place: string) => {
    if (!place.trim()) return;
    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(place)}`);
      const body = await response.json();
      if (!body.ok) {
        setWeatherError(body.error ?? "couldn't load the forecast");
        return;
      }
      setWeatherError(null);
      setWeather({
        temperatureC: Math.round(body.forecast.temperatureC),
        humidity: Math.round(body.forecast.humidity),
        precipitationChance: Math.round(body.forecast.precipitationChance),
        description: body.forecast.description,
        place: body.forecast.place,
      });
    } catch {
      setWeatherError("couldn't reach the weather service");
    }
  }, []);

  async function saveCity() {
    const next = cityDraft.trim();
    if (!next) return;
    setCity(next);
    await Promise.all([
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeCity: next }),
      }),
      loadWeather(next),
    ]);
  }

  async function suggest() {
    setLoading(true);
    setError(null);
    setOutfits([]);
    setGap(null);
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: customOccasion.trim() || occasion,
          city: city || undefined,
          indoorOutdoor,
          userRequest: request.trim() || undefined,
          weather: weather
            ? {
                temperatureC: weather.temperatureC,
                humidity: weather.humidity,
                precipitationChance: weather.precipitationChance,
              }
            : undefined,
        }),
      });
      const body = await response.json();
      setRelaxed(body.relaxed ?? []);
      setGap(body.gap ?? null);
      if (!body.ok) {
        setError(body.error ?? "couldn't put an outfit together");
        return;
      }
      setOutfits(body.outfits ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Weather */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        {!city ? (
          <div className="space-y-2">
            <label htmlFor="city" className="text-sm font-medium">
              Where are you today?
            </label>
            <div className="flex gap-2">
              <input
                id="city"
                value={cityDraft}
                onChange={(e) => setCityDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCity()}
                placeholder="City"
                className="h-11 flex-1 rounded-full border border-border bg-background px-4 text-sm"
              />
              <button
                type="button"
                onClick={saveCity}
                className="h-11 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-muted">
              Used for the forecast. You can change it any time.
            </p>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {weather
                  ? `${weather.temperatureC}°C, ${weather.description}`
                  : (weatherError ?? "Tap refresh for the forecast")}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {weather
                  ? `${weather.place ?? city} · humidity ${weather.humidity}% · rain ${weather.precipitationChance}%`
                  : (weatherError ?? city)}
              </p>
            </div>
            <div className="flex flex-none gap-3">
              <button
                type="button"
                onClick={() => void loadWeather(city)}
                className="text-xs text-muted underline underline-offset-4"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setEditingWeather((v) => !v)}
                className="text-xs text-muted underline underline-offset-4"
              >
                {editingWeather ? "Done" : "Edit"}
              </button>
            </div>
          </div>
        )}

        {editingWeather && weather && (
          <div className="mt-4 space-y-3 border-t border-border pt-3">
            <NumberField
              label="Temperature (°C)"
              value={weather.temperatureC}
              min={-30}
              max={55}
              onChange={(v) => setWeather({ ...weather, temperatureC: v })}
            />
            <NumberField
              label="Humidity (%)"
              value={weather.humidity}
              min={0}
              max={100}
              onChange={(v) => setWeather({ ...weather, humidity: v })}
            />
            <NumberField
              label="Rain chance (%)"
              value={weather.precipitationChance}
              min={0}
              max={100}
              onChange={(v) => setWeather({ ...weather, precipitationChance: v })}
            />
            <div className="flex items-center gap-2">
              <input
                value={cityDraft}
                onChange={(e) => setCityDraft(e.target.value)}
                placeholder="Somewhere else?"
                className="h-10 flex-1 rounded-full border border-border bg-background px-3 text-sm"
              />
              <button
                type="button"
                onClick={saveCity}
                className="h-10 rounded-full border border-border px-3 text-xs"
              >
                Use city
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Occasion */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">What&rsquo;s the occasion?</h2>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((item) => {
            const active = occasion === item && !customOccasion.trim();
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setOccasion(item);
                  setCustomOccasion("");
                }}
                aria-pressed={active}
                className={`h-10 rounded-full border px-4 text-sm transition ${
                  active
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border text-muted"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <input
          value={customOccasion}
          onChange={(e) => setCustomOccasion(e.target.value)}
          placeholder="Or type it: cousin's sangeet, 7pm, outdoors"
          className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm"
        />

        <div className="flex gap-2">
          {(["indoor", "mixed", "outdoor"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIndoorOutdoor(option)}
              aria-pressed={indoorOutdoor === option}
              className={`h-9 flex-1 rounded-full border text-xs capitalize transition ${
                indoorOutdoor === option
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      {/* Free-text override */}
      <section className="space-y-2">
        <label htmlFor="request" className="text-sm font-medium">
          Anything else?
        </label>
        <input
          id="request"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="same as yesterday but dressier · something with the white sneakers"
          className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm"
        />
      </section>

      <button
        type="button"
        onClick={suggest}
        disabled={loading}
        className="h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-foreground disabled:opacity-50"
      >
        {loading ? "Putting looks together…" : "Suggest outfits"}
      </button>

      {loading && (
        <p className="text-center text-xs text-muted">
          Reading your wardrobe locally — this takes about half a minute.
        </p>
      )}

      {error && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm">{error}</p>
          {gap && (
            <p className="mt-2 text-sm text-muted">
              <span className="font-medium text-foreground">{gap.item}</span> —{" "}
              {gap.why}
            </p>
          )}
        </div>
      )}

      {relaxed.length > 0 && outfits.length > 0 && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
          Your wardrobe was thin for this, so I loosened{" "}
          {relaxed.join(" and ")} to find these.
        </p>
      )}

      {outfits.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Three to choose from</h2>
            <button
              type="button"
              onClick={suggest}
              className="text-xs text-muted underline underline-offset-4"
            >
              Regenerate
            </button>
          </div>

          {/* Swipeable on a phone, a grid on a desktop. */}
          <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {outfits.map((outfit, index) => (
              <OutfitCard
                key={outfit.candidateId + index}
                outfit={outfit}
                index={index}
                onWorn={() => undefined}
                onSkipped={() => undefined}
              />
            ))}
          </div>

          {gap && (
            <p className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
              <span className="font-medium text-foreground">
                Worth buying: {gap.item}
              </span>{" "}
              — {gap.why}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-muted">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm text-foreground"
      />
    </label>
  );
}
