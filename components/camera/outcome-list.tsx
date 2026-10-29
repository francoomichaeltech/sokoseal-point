"use client";

import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import type { Outcome } from "@/lib/commerce/types";
import { useMessages } from "@/lib/i18n/locale";

export type HoldOutcome = { phase: "checking" } | { phase: "done"; outcomes: Outcome[] };

export function OutcomeList({ outcome }: { outcome: HoldOutcome }) {
  const t = useMessages().point;

  if (outcome.phase === "checking") {
    return (
      <p className="flex items-center gap-1.5 text-muted">
        <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />
        {t.outcome.checking}
      </p>
    );
  }

  return (
    <ol className="flex max-h-32 w-full flex-col gap-1 overflow-y-auto text-left">
      {outcome.outcomes.map((item, index) => (
        <li
          key={index}
          className={`flex items-start gap-2 rounded-control border px-2 py-1 ${
            item.status === "applied" ? "border-line bg-surface" : "border-attention/40 bg-attention-soft"
          }`}
        >
          {item.status === "applied" ? (
            <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-verified" />
          ) : (
            <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0 text-attention" />
          )}
          <span className="min-w-0 flex-1">
            <span data-qty className="font-semibold">
              {t.intent.actions[item.action]} {item.quantity ?? (item.action === "REMOVE" ? t.intent.all : "?")}
              {item.status === "applied" && ` · ${item.name}`}
            </span>
            <span className="block truncate text-xs text-muted">
              {item.status === "applied" ? t.outcome.now(item.lineQuantity) : t.outcome.reasons[item.reason]}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}