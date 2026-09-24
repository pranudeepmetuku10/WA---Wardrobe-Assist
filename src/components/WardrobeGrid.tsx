"use client";

import { useMemo, useState } from "react";

import {
  GarmentReviewCard,
  type ReviewGarment,
} from "@/components/GarmentReviewCard";
import { CATEGORIES } from "@/lib/garments/attributes";

export interface WardrobeItem extends ReviewGarment {
  status: string;
  wearCount: number;
  lastWornAt: string | null;
  isFavorite: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  IN_LAUNDRY: "In laundry",
  DRY_CLEAN: "Dry clean",
  STORED: "Stored",
  RETIRED: "Retired",
};

export function WardrobeGrid({ initialItems }: { initialItems: WardrobeItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editing, setEditing] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "ALL" && item.category !== category) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.subcategory.toLowerCase().includes(q) ||
        item.styleTags.some((tag) => tag.includes(q)) ||
        item.colors.some((colour) => colour.name.includes(q))
      );
    });
  }, [items, query, category, statusFilter]);

  async function setStatus(id: string, status: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    await fetch(`/api/garments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  const counts = useMemo(() => {
    const laundry = items.filter((i) => i.status === "IN_LAUNDRY").length;
    const available = items.filter((i) => i.status === "AVAILABLE").length;
    return { laundry, available };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — linen, navy, loafers"
          className="h-11 w-full rounded-full border border-border bg-surface px-4 text-sm"
          aria-label="Search your wardrobe"
        />

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={category === "ALL"} onClick={() => setCategory("ALL")}>
            All
          </Chip>
          {CATEGORIES.map((item) => (
            <Chip
              key={item}
              active={category === item}
              onClick={() => setCategory(item)}
            >
              {item.toLowerCase().replace(/_/g, " ")}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            {counts.available} available · {counts.laundry} in laundry
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-auto h-8 rounded-lg border border-border bg-surface px-2 text-xs"
            aria-label="Filter by status"
          >
            <option value="ALL">Any status</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nothing matches.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => setEditing(editing === item.id ? null : item.id)}
                className="block w-full text-left"
              >
                <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt={item.subcategory}
                      className={`aspect-[3/4] w-full object-cover transition ${
                        item.status === "AVAILABLE" ? "" : "opacity-40 grayscale"
                      }`}
                    />
                  ) : (
                    <div className="flex aspect-[3/4] w-full items-center justify-center px-2 text-center text-xs text-muted">
                      {item.subcategory}
                    </div>
                  )}
                  {item.status !== "AVAILABLE" && (
                    <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px]">
                      {STATUS_LABEL[item.status]}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-medium">
                  {item.subcategory}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {item.wearCount > 0 ? `worn ${item.wearCount}×` : "never worn"}
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatus(
                    item.id,
                    item.status === "IN_LAUNDRY" ? "AVAILABLE" : "IN_LAUNDRY",
                  )
                }
                className="w-full rounded-full border border-border py-1 text-[11px] text-muted"
              >
                {item.status === "IN_LAUNDRY" ? "Back from laundry" : "In laundry"}
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-4 sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Edit item</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-sm text-muted underline underline-offset-4"
              >
                Close
              </button>
            </div>
            {(() => {
              const item = items.find((i) => i.id === editing);
              if (!item) return null;
              return (
                <GarmentReviewCard
                  garment={item}
                  onSaved={(saved) => {
                    setItems((current) =>
                      current.map((i) =>
                        i.id === saved.id ? { ...i, ...saved } : i,
                      ),
                    );
                    setEditing(null);
                  }}
                  onDeleted={(id) => {
                    setItems((current) => current.filter((i) => i.id !== id));
                    setEditing(null);
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 flex-none rounded-full border px-3.5 text-xs capitalize transition ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border text-muted"
      }`}
    >
      {children}
    </button>
  );
}
