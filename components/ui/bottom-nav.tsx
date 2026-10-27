"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, LocateFixed, ShoppingCart } from "lucide-react";
import { useMessages } from "@/lib/i18n/locale";

const items = [
  { href: "/products", key: "products", Icon: Box },
  { href: "/point", key: "point", Icon: LocateFixed },
  { href: "/basket", key: "basket", Icon: ShoppingCart },
] as const;

type BottomNavProps = {
  basketCount?: number;
};

export function BottomNav({ basketCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const t = useMessages();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-safe"
    >
      <ul className="mx-auto grid h-(--nav-height) max-w-md grid-cols-3">
        {items.map(({ href, key, Icon }) => {
          const active = pathname.startsWith(href);

          const linkProps = {
            href,
            "aria-current": active ? ("page" as const) : undefined,
            className: `relative flex h-full flex-col items-center justify-center gap-1 text-xs font-medium ${
              active ? "text-primary" : "text-ink"
            }`,
          };

          return (
            <li key={href}>
              <Link {...linkProps}>
                <span className="relative">
                  <Icon aria-hidden size={22} strokeWidth={1.75} />
                  {key === "basket" && basketCount > 0 && (
                    <span
                      data-qty
                      className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-white"
                    >
                      {basketCount}
                    </span>
                  )}
                </span>
                {t.nav[key]}
                {active && (
                  <span aria-hidden className="absolute bottom-1.5 h-0.5 w-6 rounded-full bg-primary" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}