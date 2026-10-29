"use client";

import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import type { Product } from "@/lib/catalogue/types";
import { useMessages } from "@/lib/i18n/locale";
import { formatMoney } from "@/lib/money";
import { ProductPhoto } from "./product-photo";

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const t = useMessages().products;

  return (
    <li className="rounded-card border border-line bg-surface p-3 shadow-card">
      <div className="flex gap-3">
        <ProductPhoto source={product.referenceImages[0]} alt="" className="size-20 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold">{product.name}</p>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                product.active ? "bg-verified-soft text-verified" : "bg-disabled text-muted"
              }`}
            >
              {product.active && <Check aria-hidden size={12} strokeWidth={3} />}
              {product.active ? t.active : t.inactive}
            </span>
          </div>
          <p className="text-sm text-muted">SKU {product.sku}</p>
          <p data-money className="mt-1 font-semibold">
            {formatMoney(product.price, product.currency)}
          </p>
        </div>
      </div>

      <button
        type="button"
        // A new URL per press, so a kept-alive form always loads the saved values.
        onClick={() => router.push(`/products/edit?id=${encodeURIComponent(product.id)}&s=${Date.now()}`)}
        className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-control border border-line text-sm font-medium"
      >
        <Pencil aria-hidden size={16} />
        {t.edit}
      </button>
    </li>
  );
}