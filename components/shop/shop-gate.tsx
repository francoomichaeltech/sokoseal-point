"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "@/lib/shop/store";

export function ShopGate({ children }: { children: ReactNode }) {
  const shop = useShop();
  const router = useRouter();

  useEffect(() => {
    if (shop === null) router.replace("/setup");
  }, [shop, router]);

  return shop ? children : null;
}