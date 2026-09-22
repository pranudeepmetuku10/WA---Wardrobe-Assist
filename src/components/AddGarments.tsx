"use client";

import { useCallback, useRef, useState } from "react";

import { mapWithConcurrency, prepareImage } from "@/lib/client/image";
import {
  GarmentReviewCard,
  type ReviewGarment,
} from "@/components/GarmentReviewCard";

/** Ollama serves a couple of requests at a time; more just queues and adds latency. */
const UPLOAD_CONCURRENCY = 3;

type QueueStatus =
  | "queued"
  | "resizing"
  | "uploading"
  | "extracting"
  | "done"
  | "failed";

interface QueueItem {
  id: string;
  name: string;
  status: QueueStatus;
  previewUrl: string;
  error?: string;
  itemsFound?: number;
}

export function AddGarments({ initialDrafts }: { initialDrafts: ReviewGarment[] }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [drafts, setDrafts] = useState<ReviewGarment[]>(initialDrafts);
  const [dragging, setDragging] = useState(false);
  const [description, setDescription] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const patchItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const ingest = useCallback(
    async (files: File[]) => {
      const items: QueueItem[] = files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name || "photo",
        status: "queued",
        previewUrl: URL.createObjectURL(file),
      }));
      setQueue((current) => [...items, ...current]);

      await mapWithConcurrency(files, UPLOAD_CONCURRENCY, async (file, index) => {
        const item = items[index];
        try {
          patchItem(item.id, { status: "resizing" });
          const prepared = await prepareImage(file);

          const form = new FormData();
          form.append("image", prepared.full, "garment.jpg");
          form.append("thumbnail", prepared.thumb, "thumb.jpg");

          patchItem(item.id, { status: "extracting" });
          const response = await fetch("/api/garments/ingest", {
            method: "POST",
            body: form,
          });
          const body = await response.json();

          if (!body.ok) {
            patchItem(item.id, {
              status: "failed",
              error: body.needsManualEntry
                ? "Couldn't read this one — add it by hand below."
                : (body.error ?? "upload failed"),
            });
            return;
          }

          setDrafts((current) => [...body.garments, ...current]);
          patchItem(item.id, {
            status: "done",
            itemsFound: body.garments.length,
          });
        } catch (error) {
          patchItem(item.id, {
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
    [patchItem],
  );

  function onFiles(list: FileList | null) {
    if (!list?.length) return;
    void ingest(Array.from(list).filter((f) => f.type.startsWith("image/")));
  }

  async function addByText() {
    if (description.trim().length < 3) return;
    setTextBusy(true);
    try {
      const response = await fetch("/api/garments/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const body = await response.json();
      if (body.ok) {
        setDrafts((current) => [...body.garments, ...current]);
        setDescription("");
      }
    } finally {
      setTextBusy(false);
    }
  }

  const unverified = drafts.filter((d) => !d.userVerified);

  async function acceptAll() {
    if (!unverified.length) return;
    setBulkBusy(true);
    try {
      const ids = unverified.map((d) => d.id);
      const response = await fetch("/api/garments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if ((await response.json()).ok) {
        setDrafts((current) =>
          current.map((d) =>
            ids.includes(d.id) ? { ...d, userVerified: true } : d,
          ),
        );
      }
    } finally {
      setBulkBusy(false);
    }
  }

  const active = queue.filter(
    (q) => q.status !== "done" && q.status !== "failed",
  ).length;

  return (
    <div className="space-y-8">
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragging ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        <p className="text-sm font-medium">Add your clothes</p>
        <p className="mt-1 text-xs text-muted">
          Drop photos here, or use the buttons. Several items in one photo is
          fine — you confirm the split.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="h-11 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground"
          >
            Choose photos
          </button>
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="h-11 rounded-full border border-border px-5 text-sm font-medium sm:hidden"
          >
            Take a photo
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </section>

      <section className="space-y-2">
        <label className="text-sm font-medium" htmlFor="text-entry">
          Or describe one
        </label>
        <div className="flex gap-2">
          <input
            id="text-entry"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addByText()}
            placeholder="navy linen blazer, slim fit"
            className="h-11 flex-1 rounded-full border border-border bg-surface px-4 text-sm"
          />
          <button
            type="button"
            onClick={addByText}
            disabled={textBusy || description.trim().length < 3}
            className="h-11 rounded-full border border-border px-4 text-sm disabled:opacity-40"
          >
            {textBusy ? "Reading…" : "Add"}
          </button>
        </div>
      </section>

      {queue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">
            Processing {active > 0 ? `(${active} left)` : "— done"}
          </h2>
          <ul className="space-y-1.5">
            {queue.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-9 w-9 rounded object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-xs">
                  {item.name}
                </span>
                <StatusPill item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Review {unverified.length > 0 && `(${unverified.length} to check)`}
          </h2>
          {unverified.length > 0 && (
            <button
              type="button"
              onClick={acceptAll}
              disabled={bulkBusy}
              className="h-9 rounded-full bg-accent px-4 text-xs font-medium text-accent-foreground disabled:opacity-40"
            >
              {bulkBusy ? "Accepting…" : `Accept all ${unverified.length}`}
            </button>
          )}
        </div>

        {drafts.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
            Nothing to review yet. Add a few photos above.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {drafts.map((garment) => (
              <GarmentReviewCard
                key={garment.id}
                garment={garment}
                onSaved={(saved) =>
                  setDrafts((current) =>
                    current.map((d) => (d.id === saved.id ? saved : d)),
                  )
                }
                onDeleted={(id) =>
                  setDrafts((current) => current.filter((d) => d.id !== id))
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ item }: { item: QueueItem }) {
  const label: Record<QueueStatus, string> = {
    queued: "queued",
    resizing: "resizing",
    uploading: "uploading",
    extracting: "reading…",
    done: item.itemsFound && item.itemsFound > 1
      ? `${item.itemsFound} items`
      : "added",
    failed: "failed",
  };

  const tone =
    item.status === "done"
      ? "text-accent"
      : item.status === "failed"
        ? "text-red-600"
        : "text-muted";

  return (
    <span className={`flex-none text-xs ${tone}`} title={item.error}>
      {label[item.status]}
    </span>
  );
}
