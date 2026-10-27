"use client";

import { ProductForm } from "@/components/products/product-form";
import { useShop } from "@/lib/shop/store";

export default function NewProductPage() {
  const shop = useShop();
  // ShopGate renders this page only after a shop exists.
  if (!shop) return null;

  return <ProductForm currency={shop.currency} />;
}