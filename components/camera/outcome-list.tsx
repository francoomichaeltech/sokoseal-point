"use client";

import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import type { Outcome } from "@/lib/commerce/types";
import { useMessages } from "@/lib/i18n/locale";

export type HoldOutcome = { phase: "checking" } | { phase: "done"; outcomes: Outcome[] };

export function OutcomeList({ outcome }: { outcome: HoldOutcome }) {
  const t = useMessages().point;

  if (outcome.phase === "checking") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />
        {t.outcome.checking}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-control border border-line">
      {outcome.outcomes.map((item, index) => {
        const applied = item.status === "applied";
        const quantity = item.quantity ?? (item.action === "REMOVE" ? t.intent.all : "?");

        return (
          <li key={index} className="flex items-center gap-3 bg-surface px-3 py-2.5">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full ${
                applied ? "bg-verified-soft text-verified" : "bg-attention-soft text-attention"
              }`}
            >
              {applied ? <Check aria-hidden size={15} strokeWidth={3} /> : <TriangleAlert aria-hidden size={15} />}
            </span>
            <div className="min-w-0 flex-1">
              <p data-qty className="truncate text-sm font-semibold">
                {t.intent.actions[item.action]} {quantity}
                {applied && ` · ${item.name}`}
              </p>
              <p className="truncate text-xs text-muted">
                {applied ? t.outcome.now(item.lineQuantity) : t.outcome.reasons[item.reason]}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}