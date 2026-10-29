"use client";

import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2 } from "lucide-react";
import type { Product } from "@/lib/catalogue/types";
import { useMessages } from "@/lib/i18n/locale";
import { formatMoney } from "@/lib/money";
import { ProductPhoto } from "./product-photo";

type ProductCardProps = {
  product: Product;
  onDelete: () => void;
};

export function ProductCard({ product, onDelete }: ProductCardProps) {
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

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          // A new URL per press, so a kept-alive form always loads the saved values.
          onClick={() => router.push(`/products/edit?id=${encodeURIComponent(product.id)}&s=${Date.now()}`)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-control border border-line text-sm font-medium"
        >
          <Pencil aria-hidden size={16} />
          {t.edit}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-10 items-center justify-center gap-1.5 rounded-control border border-line text-sm font-medium text-danger"
        >
          <Trash2 aria-hidden size={16} />
          {t.delete}
        </button>
      </div>
    </li>
  );
}