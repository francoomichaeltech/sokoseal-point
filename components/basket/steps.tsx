"use client";

import { Check } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";

// Review -> Seal -> Sealed, so the user always knows where the basket is. Steps before `current` are done.
export function BasketSteps({ current }: { current: number }) {
  const steps = useMessages().basket.steps;

  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                done ? "bg-verified text-white" : active ? "bg-primary text-white" : "bg-disabled text-muted"
              }`}
            >
              {done ? <Check aria-hidden size={13} strokeWidth={3} /> : index + 1}
            </span>
            <span className={`text-xs font-medium whitespace-nowrap ${active || done ? "text-ink" : "text-muted"}`}>
              {label}
            </span>
            {index < steps.length - 1 && <span aria-hidden className="h-px min-w-3 flex-1 bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}