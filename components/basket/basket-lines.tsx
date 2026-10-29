"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { setLineQuantity } from "@/lib/commerce/store";
import type { BasketLine } from "@/lib/commerce/types";
import { useMessages } from "@/lib/i18n/locale";
import { formatMoney } from "@/lib/money";

type BasketLinesProps = { lines: BasketLine[]; readOnly?: boolean };

export function BasketLines({ lines, readOnly = false }: BasketLinesProps) {
  const t = useMessages().basket;
  const currency = lines[0]?.currency;
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const stepButton = "grid size-9 place-items-center rounded-full";

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <ul className="divide-y divide-line">
        {lines.map((line) => (
          <li key={line.sku} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{line.name}</p>
              <p data-money className="text-sm text-muted">
                {formatMoney(line.unitPrice, line.currency)} · {formatMoney(line.unitPrice * line.quantity, line.currency)}
              </p>
            </div>

            {readOnly ? (
              <span data-qty className="shrink-0 font-semibold">
                × {line.quantity}
              </span>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <div className="flex items-center rounded-full border border-line">
                  <button
                    type="button"
                    aria-label={t.decrease(line.name)}
                    onClick={() => setLineQuantity(line.sku, line.quantity - 1)}
                    className={stepButton}
                  >
                    <Minus aria-hidden size={16} />
                  </button>
                  <span data-qty className="w-7 text-center font-semibold">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={t.increase(line.name)}
                    onClick={() => setLineQuantity(line.sku, line.quantity + 1)}
                    className={stepButton}
                  >
                    <Plus aria-hidden size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={t.remove(line.name)}
                  onClick={() => setLineQuantity(line.sku, 0)}
                  className={`${stepButton} text-danger`}
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {currency && (
        <div className="flex items-center justify-between border-t border-line bg-canvas px-4 py-3">
          <span className="font-semibold">{t.total}</span>
          <span data-money className="text-lg font-bold">
            {formatMoney(total, currency)}
          </span>
        </div>
      )}
    </section>
  );
}