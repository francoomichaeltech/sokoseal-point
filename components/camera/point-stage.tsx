"use client";

import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { useProducts } from "@/lib/catalogue/store";
import { useMessages } from "@/lib/i18n/locale";
import { PointSession } from "./point-session";

export function PointStage() {
  const products = useProducts();
  const t = useMessages().point.empty;

  if (!products) return null;

  // Nothing to match against, so the camera is not started.
  if (!products.some((product) => product.active)) {
    const addLinkProps = {
      href: "/products/new",
      className: "mt-5 flex h-12 items-center rounded-card bg-primary px-5 font-semibold text-white",
    };

    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <PackagePlus aria-hidden size={32} strokeWidth={1.5} className="text-muted" />
        <p className="mt-3 font-semibold">{t.title}</p>
        <p className="mt-1 max-w-64 text-sm text-muted">{t.body}</p>
        <Link {...addLinkProps}>{t.action}</Link>
      </div>
    );
  }

  return <PointSession />;
}