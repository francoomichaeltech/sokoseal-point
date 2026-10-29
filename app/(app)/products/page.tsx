"use client";

import { useRouter } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { ProductCard } from "@/components/products/product-card";
import { useProducts } from "@/lib/catalogue/store";
import { useMessages } from "@/lib/i18n/locale";
import { useShop } from "@/lib/shop/store";

export default function ProductsPage() {
  const router = useRouter();
  const products = useProducts();
  const shop = useShop();
  const t = useMessages().products;

  if (!products || !shop) return null;

  const activeCount = products.filter((product) => product.active).length;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted">{t.summary(activeCount, shop.currency)}</p>
        </div>
        <button
          type="button"
          // A new URL per press, so a kept-alive form never shows the previous product.
          onClick={() => router.push(`/products/new?s=${Date.now()}`)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-card bg-primary px-4 text-sm font-semibold text-white"
        >
          <Plus aria-hidden size={18} />
          {t.add}
        </button>
      </div>

      {products.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <Package aria-hidden size={32} strokeWidth={1.5} className="text-muted" />
          <p className="mt-3 font-semibold">{t.emptyTitle}</p>
          <p className="mt-1 max-w-64 text-sm text-muted">{t.emptyBody}</p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ul>
      )}
    </>
  );
}