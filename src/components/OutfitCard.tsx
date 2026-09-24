"use client";

import { useState } from "react";

export interface OutfitGarmentView {
  id: string;
  subcategory: string;
  category: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
}

export interface OutfitView {
  outfitId?: string;
  candidateId: string;
  title: string;
  reasoning: string;
  stylingTips: string[];
  confidence: number;
  wildcard: boolean;
  garments: OutfitGarmentView[];
}

interface Props {
  outfit: OutfitView;
  index: number;
  onWorn: (outfitId: string) => void;
  onSkipped: (outfitId: string) => void;
}

/**
 * The garment photos are the interface — they lead, the words follow.
 */
export function OutfitCard({ outfit, index, onWorn, onSkipped }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<"worn" | "skipped" | null>(null);
  const [rating, setRating] = useState<number | null>(null);

  async function send(action: "worn" | "skipped" | "rated", value?: number) {
    if (!outfit.outfitId) return;
    setBusy(action);
    try {
      await fetch(`/api/outfits/${outfit.outfitId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rating: value }),
      });
      if (action === "worn") {
        setDone("worn");
        onWorn(outfit.outfitId);
      }
      if (action === "skipped") {
        setDone("skipped");
        onSkipped(outfit.outfitId);
      }
      if (action === "rated" && value) setRating(value);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className={`flex w-[85vw] max-w-sm flex-none snap-center flex-col overflow-hidden rounded-3xl border bg-surface transition sm:w-auto sm:max-w-none ${
        done === "skipped" ? "border-border opacity-50" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-xs text-muted">Option {index + 1}</span>
        {outfit.wildcard && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-500">
            Wildcard
          </span>
        )}
      </div>

      <h3 className="px-4 pt-1 text-base font-semibold tracking-tight">
        {outfit.title}
      </h3>

      {/* The look, as photographs. */}
      <div className="mt-3 grid grid-cols-3 gap-1 px-4">
        {outfit.garments.slice(0, 6).map((garment) => (
          <figure key={garment.id} className="relative">
            {garment.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={garment.thumbnailUrl}
                alt={garment.subcategory}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-background px-1 text-center text-[10px] leading-tight text-muted">
                {garment.subcategory}
              </div>
            )}
          </figure>
        ))}
      </div>

      <p className="px-4 pt-3 text-[13px] leading-relaxed text-muted">
        {outfit.garments.map((g) => g.subcategory).join(" · ")}
      </p>

      <p className="px-4 pt-3 text-sm leading-relaxed">{outfit.reasoning}</p>

      {outfit.stylingTips.length > 0 && (
        <ul className="mt-3 space-y-1.5 px-4">
          {outfit.stylingTips.map((tip, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-muted">
              <span aria-hidden className="text-accent">
                —
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto space-y-3 p-4">
        {done === "worn" ? (
          <div className="space-y-2">
            <p className="text-sm text-accent">Logged. Enjoy it.</p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted">Rate it:</span>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => send("rated", value)}
                  aria-label={`${value} out of 5`}
                  className={`h-8 w-8 rounded-full text-sm ${
                    rating && value <= rating
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-muted"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ) : done === "skipped" ? (
          <p className="text-sm text-muted">Skipped for today.</p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => send("worn")}
              disabled={busy !== null || !outfit.outfitId}
              className="h-11 flex-1 rounded-full bg-accent text-sm font-medium text-accent-foreground disabled:opacity-40"
            >
              {busy === "worn" ? "Saving…" : "Wear this"}
            </button>
            <button
              type="button"
              onClick={() => send("skipped")}
              disabled={busy !== null || !outfit.outfitId}
              className="h-11 rounded-full border border-border px-4 text-sm disabled:opacity-40"
            >
              Not today
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
