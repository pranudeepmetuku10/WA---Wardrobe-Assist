"use client";

import { useState } from "react";

import {
  CATEGORIES,
  FITS,
  MATERIALS,
  PATTERNS,
  SEASONS,
  type GarmentColor,
} from "@/lib/garments/attributes";

export interface ReviewGarment {
  id: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  category: string;
  subcategory: string;
  colors: GarmentColor[];
  pattern: string;
  materials: string[];
  formality: number;
  warmth: number;
  seasons: string[];
  fit: string;
  styleTags: string[];
  aiConfidence: number | null;
  userVerified: boolean;
}

interface Props {
  garment: ReviewGarment;
  onSaved: (garment: ReviewGarment) => void;
  onDeleted: (id: string) => void;
}

/**
 * One extracted garment, editable in place. This screen is where extraction
 * errors get caught, so every field the model guesses is reachable in one tap
 * — no drilling into a detail page.
 */
export function GarmentReviewCard({ garment, onSaved, onDeleted }: Props) {
  const [draft, setDraft] = useState(garment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(garment);
  const lowConfidence = (garment.aiConfidence ?? 1) < 0.7;

  function set<K extends keyof ReviewGarment>(key: K, value: ReviewGarment[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: "seasons" | "materials", value: string) {
    setDraft((current) => {
      const list = current[key];
      return {
        ...current,
        [key]: list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value],
      };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/garments/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: draft.category,
          subcategory: draft.subcategory,
          colors: draft.colors,
          pattern: draft.pattern,
          materials: draft.materials,
          formality: draft.formality,
          warmth: draft.warmth,
          seasons: draft.seasons,
          fit: draft.fit,
          styleTags: draft.styleTags,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `save failed (${response.status})`);
      }
      onSaved({ ...draft, userVerified: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await fetch(`/api/garments/${draft.id}`, { method: "DELETE" });
      onDeleted(draft.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex gap-3 p-3">
        {draft.thumbnailUrl ? (
          // Plain img: these are local files of unknown dimensions, and the
          // review grid is short-lived — next/image buys nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.thumbnailUrl}
            alt={draft.subcategory}
            className="h-24 w-20 flex-none rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-24 w-20 flex-none items-center justify-center rounded-lg bg-background text-xs text-muted">
            no photo
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={draft.subcategory}
            onChange={(e) => set("subcategory", e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-medium"
            aria-label="Item name"
          />
          <div className="flex flex-wrap gap-2">
            <Select
              label="Category"
              value={draft.category}
              options={CATEGORIES}
              onChange={(v) => set("category", v)}
            />
            <Select
              label="Pattern"
              value={draft.pattern}
              options={PATTERNS}
              onChange={(v) => set("pattern", v)}
            />
            <Select
              label="Fit"
              value={draft.fit}
              options={FITS}
              onChange={(v) => set("fit", v)}
            />
          </div>
          {lowConfidence && !garment.userVerified && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Low confidence ({Math.round((garment.aiConfidence ?? 0) * 100)}%) —
              worth a look.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border px-3 py-3">
        <div className="grid grid-cols-2 gap-3">
          <Range
            label="Formality"
            hint={FORMALITY_HINTS[draft.formality - 1]}
            value={draft.formality}
            onChange={(v) => set("formality", v)}
          />
          <Range
            label="Warmth"
            hint={WARMTH_HINTS[draft.warmth - 1]}
            value={draft.warmth}
            onChange={(v) => set("warmth", v)}
          />
        </div>

        <ChipRow
          label="Seasons"
          options={SEASONS}
          selected={draft.seasons}
          onToggle={(v) => toggle("seasons", v)}
        />
        <ChipRow
          label="Materials"
          options={MATERIALS.slice(0, 12)}
          selected={draft.materials}
          onToggle={(v) => toggle("materials", v)}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Colours</span>
          {draft.colors.map((color, index) => (
            <label key={index} className="flex items-center gap-1">
              <input
                type="color"
                value={color.hex}
                onChange={(e) => {
                  const colors = [...draft.colors];
                  colors[index] = { ...color, hex: e.target.value };
                  set("colors", colors);
                }}
                className="h-6 w-6 rounded border border-border bg-transparent p-0"
                aria-label={`${color.name} colour`}
              />
              <span className="text-xs text-muted">{color.name}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="border-t border-border px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={remove}
          disabled={saving}
          className="text-xs text-muted underline underline-offset-4"
        >
          Discard
        </button>
        <div className="flex items-center gap-2">
          {garment.userVerified && !dirty && (
            <span className="text-xs text-accent">Saved</span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || (!dirty && garment.userVerified)}
            className="h-9 rounded-full bg-accent px-4 text-xs font-medium text-accent-foreground disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Looks right"}
          </button>
        </div>
      </div>
    </article>
  );
}

const FORMALITY_HINTS = ["lounge", "casual", "smart casual", "formal", "black tie"];
const WARMTH_HINTS = ["sheer", "light", "mid", "warm", "heavy"];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs text-muted">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.toLowerCase().replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function Range({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs text-muted">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-foreground">{hint}</span>
      </span>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-accent"
      />
    </label>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted"
              }`}
            >
              {option.toLowerCase().replace(/_/g, " ")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
