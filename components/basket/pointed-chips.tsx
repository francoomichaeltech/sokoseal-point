"use client";

import { Check } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";
import type { PointedMark } from "@/lib/pointing/locate";

// One small label per pointing: the product and whether the shop sells it.
export function PointedChips({ marks }: { marks: PointedMark[] }) {
  const t = useMessages();

  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {marks.map((mark, index) => {
        const found = mark.target.state === "product";
        const text = found
          ? t.basket.inShop(mark.name ?? "")
          : mark.target.state === "ambiguous"
            ? t.basket.unclear
            : mark.target.state === "error"
              ? t.point.identity.error
              : t.basket.notInShop;

        return (
          <li
            key={index}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              found ? "bg-verified-soft text-verified" : "bg-disabled text-muted"
            }`}
          >
            {found && <Check aria-hidden size={12} strokeWidth={3} />}
            {text}
          </li>
        );
      })}
    </ul>
  );
}