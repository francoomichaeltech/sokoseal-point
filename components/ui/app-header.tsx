"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";
import { useShop } from "@/lib/shop/store";
import { Wordmark } from "./wordmark";

export function AppHeader({ trailing }: { trailing?: React.ReactNode }) {
  const pathname = usePathname();
  const shop = useShop();
  const t = useMessages();
  const onSettings = pathname === "/settings";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface pt-safe">
      <div className="mx-auto flex h-(--header-height) max-w-md items-center justify-between px-4">
        <Wordmark />
        {trailing ??
          (shop ? (
            <Link
              href="/settings"
              aria-label={t.settings.title}
              aria-current={onSettings ? "page" : undefined}
              className={`grid size-11 place-items-center rounded-control ${
                onSettings ? "bg-primary-soft text-primary" : "text-ink hover:bg-canvas"
              }`}
            >
              <Settings aria-hidden size={20} strokeWidth={1.75} />
            </Link>
          ) : null)}
      </div>
    </header>
  );
}
