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

  if (!shop) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-canvas" aria-busy="true">
        <div className="h-(--header-height) border-b border-line bg-surface" />
        <div className="mx-auto w-full max-w-md flex-1 space-y-3 p-4">
          <div className="h-8 w-36 rounded-control bg-line/60" />
          <div className="h-24 rounded-card border border-line bg-surface" />
          <div className="h-24 rounded-card border border-line bg-surface" />
        </div>
        <div className="h-(--nav-height) border-t border-line bg-surface" />
      </div>
    );
  }

  return children;
}