"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { useProducts } from "@/lib/catalogue/store";
import { useMessages } from "@/lib/i18n/locale";
import { useShop } from "@/lib/shop/store";

function EditProduct() {
  const params = useSearchParams();
  const id = params.get("id");
  // Each "Edit" press opens a new ?s= value, so the form always shows the saved values.
  const session = params.get("s") ?? "";
  const products = useProducts();
  const shop = useShop();
  const t = useMessages().productForm;

  if (!products || !shop) return null;

  const product = products.find((item) => item.id === id);
  if (!product) {
    const backLinkProps = {
      href: "/products",
      className: "mt-4 inline-flex h-11 items-center rounded-card border border-line bg-surface px-4 font-semibold",
    };

    return (
      <div className="mt-12 text-center">
        <p className="font-semibold">{t.notFound}</p>
        <Link {...backLinkProps}>{t.back}</Link>
      </div>
    );
  }

  return <ProductForm key={`${product.id}-${session}`} product={product} currency={shop.currency} />;
}

export default function EditProductPage() {
  return (
    <Suspense>
      <EditProduct />
    </Suspense>
  );
}