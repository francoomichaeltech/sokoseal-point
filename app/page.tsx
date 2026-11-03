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

  return (
    <div className="flex min-h-dvh flex-col bg-canvas" aria-busy="true">
      <div className="h-(--header-height) border-b border-line bg-surface" />
      <div className="mx-auto w-full max-w-md flex-1 space-y-3 p-4">
        <div className="h-8 w-40 rounded-control bg-line/60" />
        <div className="h-28 rounded-card border border-line bg-surface" />
      </div>
    </div>
  );
}