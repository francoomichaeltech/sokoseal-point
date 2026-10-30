"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { Product } from "@/lib/catalogue/types";
import {
  getRecordedHold,
  updateHoldAnnotation,
  useRecorderEnabled,
  type MeantTarget,
  type RecordedHold,
} from "@/lib/debug/recorder";
import type { IntentAction } from "@/lib/intent/types";

type DebugAnnotationProps = {
  eventId: string;
  actions: IntentAction[];
  products: Product[];
};

export function DebugAnnotation({ eventId, actions, products }: DebugAnnotationProps) {
  const enabled = useRecorderEnabled();
  const [hold, setHold] = useState<RecordedHold | null>(null);
  const [status, setStatus] = useState<"correct" | "wrong">("correct");
  const [meant, setMeant] = useState<MeantTarget[]>([]);
  const [saved, setSaved] = useState(false);

  const activeProducts = products.filter((p) => p.active);

  // Load existing annotation if already recorded
  useEffect(() => {
    if (!enabled || !eventId) return;
    let cancelled = false;

    void getRecordedHold(eventId).then((h) => {
      if (cancelled || !h) return;
      setHold(h);
      if (h.annotation) {
        setStatus(h.annotation.status);
        setMeant(h.annotation.meantProducts);
        setSaved(true);
      } else {
        // Default meant products from the matched marks if available
        const initial = actions.map((_, i) => {
          const mark = h.marks[i];
          if (mark?.target.state === "product" && mark.target.sku) {
            return mark.target.sku;
          }
          if (mark?.target.state === "unknown") return "not_in_shop";
          if (mark?.target.state === "none") return "nothing";
          return activeProducts[0]?.sku ?? "nothing";
        });
        setMeant(initial);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, eventId, actions, activeProducts]);

  if (!enabled) return null;

  async function handleSave(newStatus: "correct" | "wrong", newMeant: MeantTarget[]) {
    setStatus(newStatus);
    setMeant(newMeant);
    await updateHoldAnnotation(eventId, {
      status: newStatus,
      meantProducts: newMeant,
    });
    setSaved(true);
  }

  function handleSelectMeant(index: number, val: MeantTarget) {
    const updated = [...meant];
    updated[index] = val;
    void handleSave(status, updated);
  }

  return (
    <div className="mt-4 rounded-card border-2 border-dashed border-primary/40 bg-canvas p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary uppercase tracking-wider text-[10px]">
          Hold Recorder Result
        </span>
        {saved && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-verified">
            <Check size={12} strokeWidth={2.5} /> Saved
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-muted font-medium">Result:</span>
        <button
          type="button"
          onClick={() => void handleSave("correct", meant)}
          className={`flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition ${
            status === "correct"
              ? "bg-verified text-white"
              : "border border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          <Check size={12} strokeWidth={2.5} /> Correct
        </button>
        <button
          type="button"
          onClick={() => void handleSave("wrong", meant)}
          className={`flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition ${
            status === "wrong"
              ? "bg-danger text-white"
              : "border border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          <X size={12} strokeWidth={2.5} /> Wrong
        </button>
      </div>

      {actions.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-line/50 pt-2">
          <p className="font-medium text-muted">What was actually meant:</p>
          {actions.map((action, i) => (
            <div key={i} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="truncate text-ink font-mono text-[11px]">
                #{i + 1} {action.action} {action.quantity ?? ""}{" "}
                <span className="text-muted">({action.reference})</span>
              </span>
              <select
                value={meant[i] ?? "nothing"}
                onChange={(e) => handleSelectMeant(i, e.target.value as MeantTarget)}
                aria-label={`Target product for action #${i + 1}`}
                className="h-7 rounded border border-line bg-surface px-2 text-[11px] text-ink font-medium focus:border-primary focus:outline-none"
              >
                <optgroup label="Catalogue Products">
                  {activeProducts.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Special Cases">
                  <option value="nothing">Nothing / Empty space</option>
                  <option value="not_in_shop">Not in shop</option>
                </optgroup>
              </select>
            </div>
          ))}
        </div>
      )}

      {hold && (
        <div className="mt-2 text-[10px] text-muted flex gap-2">
          <span>Samples: {hold.samples.length}</span>
          <span>•</span>
          <span>Boxes: {hold.samBoxes.length}</span>
          <span>•</span>
          <span>Duration: {Math.round(hold.durationMs)}ms</span>
        </div>
      )}
    </div>
  );
}
