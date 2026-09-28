"use client";

import { useState } from "react";

export interface LearnedView {
  summary: string;
  colorsGravitatedTo: string[];
  colorsAvoidedInPractice: string[];
  combinationsRejected: string[];
  formalityByOccasion: Array<{ occasion: string; observation: string }>;
  neverWorn: string[];
  confidence: number;
}

export interface ProfileView {
  homeCity: string | null;
  bodyNotes: string | null;
  colorsLoved: string[];
  colorsToAvoid: string[];
  neverPair: Array<{ a: string; b: string }>;
  dressCodeNotes: string | null;
  freeformPreferences: string | null;
  learnedPreferences: unknown;
  learnedPreferencesUpdated: string | null;
  wearRecencyDays: number;
}

export function StyleProfileForm({ initial }: { initial: ProfileView }) {
  const [profile, setProfile] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({ a: "", b: "" });
  const [learning, setLearning] = useState(false);
  const [learnNote, setLearnNote] = useState<string | null>(null);

  function set<K extends keyof ProfileView>(key: K, value: ProfileView[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeCity: profile.homeCity,
          bodyNotes: profile.bodyNotes,
          colorsLoved: profile.colorsLoved,
          colorsToAvoid: profile.colorsToAvoid,
          neverPair: profile.neverPair,
          dressCodeNotes: profile.dressCodeNotes,
          freeformPreferences: profile.freeformPreferences,
          learnedPreferences: profile.learnedPreferences,
          wearRecencyDays: profile.wearRecencyDays,
        }),
      });
      const body = await response.json();
      if (!body.ok) throw new Error(body.error ?? "save failed");
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  const learned = profile.learnedPreferences as LearnedView | null;

  function setLearned(next: LearnedView) {
    set("learnedPreferences", next as unknown as ProfileView["learnedPreferences"]);
  }

  /** Re-reads the wear log and rewrites what the app believes about you. */
  async function refreshLearned() {
    setLearning(true);
    setLearnNote(null);
    try {
      const response = await fetch("/api/profile/learn", { method: "POST" });
      const body = await response.json();
      if (body.ok && body.preferences) {
        setLearned(body.preferences);
        setLearnNote(`Updated from your last ${body.eventsConsidered} pieces of feedback.`);
      } else {
        setLearnNote(body.error ?? "Couldn't work anything out from the log yet.");
      }
    } catch (cause) {
      setLearnNote(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLearning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Where you are">
        <input
          value={profile.homeCity ?? ""}
          onChange={(e) => set("homeCity", e.target.value)}
          placeholder="City"
          className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm"
        />
      </Section>

      <Section
        title="Colours"
        hint="Comma separated. These steer suggestions, they don't hard-filter."
      >
        <Labelled label="Love">
          <TagInput
            values={profile.colorsLoved}
            onChange={(v) => set("colorsLoved", v)}
            placeholder="olive, navy, stone"
          />
        </Labelled>
        <Labelled label="Avoid">
          <TagInput
            values={profile.colorsToAvoid}
            onChange={(v) => set("colorsToAvoid", v)}
            placeholder="mustard, neon"
          />
        </Labelled>
      </Section>

      <Section
        title="Never pair"
        hint="Hard rules. These are never broken, whatever the occasion."
      >
        <ul className="space-y-1.5">
          {profile.neverPair.map((rule, index) => (
            <li
              key={index}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="flex-1">
                {rule.a} <span className="text-muted">with</span> {rule.b}
              </span>
              <button
                type="button"
                onClick={() =>
                  set(
                    "neverPair",
                    profile.neverPair.filter((_, i) => i !== index),
                  )
                }
                className="text-xs text-muted underline underline-offset-4"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={newRule.a}
            onChange={(e) => setNewRule({ ...newRule, a: e.target.value })}
            placeholder="brown shoes"
            className="h-10 flex-1 rounded-full border border-border bg-surface px-3 text-sm"
          />
          <input
            value={newRule.b}
            onChange={(e) => setNewRule({ ...newRule, b: e.target.value })}
            placeholder="black trousers"
            className="h-10 flex-1 rounded-full border border-border bg-surface px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!newRule.a.trim() || !newRule.b.trim()) return;
              set("neverPair", [...profile.neverPair, newRule]);
              setNewRule({ a: "", b: "" });
            }}
            className="h-10 flex-none rounded-full border border-border px-3 text-xs"
          >
            Add
          </button>
        </div>
      </Section>

      <Section title="Notes">
        <Labelled label="Fit and body">
          <textarea
            value={profile.bodyNotes ?? ""}
            onChange={(e) => set("bodyNotes", e.target.value)}
            rows={2}
            placeholder="Broad shoulders, prefer a longer hem"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
          />
        </Labelled>
        <Labelled label="Dress codes you deal with">
          <textarea
            value={profile.dressCodeNotes ?? ""}
            onChange={(e) => set("dressCodeNotes", e.target.value)}
            rows={2}
            placeholder="Office is business casual, no shorts"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
          />
        </Labelled>
        <Labelled label="Anything else">
          <textarea
            value={profile.freeformPreferences ?? ""}
            onChange={(e) => set("freeformPreferences", e.target.value)}
            rows={3}
            placeholder="I hate tucking shirts in. I wear white sneakers with everything."
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
          />
        </Labelled>
      </Section>

      <Section
        title="Repeats"
        hint="How long before an item can be suggested again. Basics are exempt."
      >
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Days between wears</span>
          <input
            type="number"
            min={0}
            max={60}
            value={profile.wearRecencyDays}
            onChange={(e) => set("wearRecencyDays", Number(e.target.value))}
            className="h-10 w-20 rounded-lg border border-border bg-surface px-2 text-right text-sm"
          />
        </label>
      </Section>

      <Section
        title="What the app thinks it has learned"
        hint="Inferred from what you actually wear. Edit anything it got wrong — this text is read back when suggesting outfits."
      >
        {learned ? (
          <div className="space-y-3">
            <textarea
              value={learned.summary}
              onChange={(e) => setLearned({ ...learned, summary: e.target.value })}
              rows={4}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed"
              aria-label="What the app learned about you"
            />

            <Labelled label="Colours you reach for">
              <TagInput
                values={learned.colorsGravitatedTo}
                onChange={(v) => setLearned({ ...learned, colorsGravitatedTo: v })}
                placeholder="olive, navy"
              />
            </Labelled>

            <Labelled label="Colours you own but skip">
              <TagInput
                values={learned.colorsAvoidedInPractice}
                onChange={(v) =>
                  setLearned({ ...learned, colorsAvoidedInPractice: v })
                }
                placeholder="mustard"
              />
            </Labelled>

            {learned.combinationsRejected.length > 0 && (
              <Labelled label="Combinations you turn down">
                <TagInput
                  values={learned.combinationsRejected}
                  onChange={(v) =>
                    setLearned({ ...learned, combinationsRejected: v })
                  }
                  placeholder=""
                />
              </Labelled>
            )}

            {learned.formalityByOccasion.length > 0 && (
              <ul className="space-y-1 rounded-2xl border border-border bg-surface p-4 text-xs text-muted">
                {learned.formalityByOccasion.map((entry, i) => (
                  <li key={i}>
                    <span className="capitalize text-foreground">{entry.occasion}</span>
                    {" — "}
                    {entry.observation}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-muted">
              Confidence {Math.round(learned.confidence * 100)}%
              {profile.learnedPreferencesUpdated
                ? ` · updated ${new Date(profile.learnedPreferencesUpdated).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            Nothing learned yet — wear a few outfits and rate them first.
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshLearned}
            disabled={learning}
            className="h-10 rounded-full border border-border px-4 text-sm disabled:opacity-50"
          >
            {learning ? "Reading your history…" : "Refresh what you've learned"}
          </button>
          {learnNote && <span className="text-xs text-muted">{learnNote}</span>}
        </div>
      </Section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="sticky bottom-20 flex items-center gap-3 sm:bottom-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-12 flex-1 rounded-full bg-accent text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        {saved && <span className="text-sm text-accent">Saved</span>}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  return (
    <input
      value={values.join(", ")}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(",")
            .map((part) => part.trim().toLowerCase())
            .filter(Boolean),
        )
      }
      placeholder={placeholder}
      className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm"
    />
  );
}
