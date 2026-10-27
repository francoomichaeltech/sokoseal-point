"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "@/lib/shop/store";

export default function Home() {
  const shop = useShop();
  const router = useRouter();

  useEffect(() => {
    if (shop !== undefined) router.replace(shop ? "/products" : "/setup");
  }, [shop, router]);

  return null;
}