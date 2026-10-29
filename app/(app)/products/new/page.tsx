"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { useShop } from "@/lib/shop/store";

function NewProduct() {
  const shop = useShop();
  // Each "Add product" press opens a new ?s= value, so the form always starts empty.
  const session = useSearchParams().get("s") ?? "";

  // ShopGate renders this page only after a shop exists.
  if (!shop) return null;

  return <ProductForm key={session} currency={shop.currency} />;
}

export default function NewProductPage() {
  return (
    <Suspense>
      <NewProduct />
    </Suspense>
  );
}