import { ShopGate } from "@/components/shop/shop-gate";
import { AppHeader } from "@/components/ui/app-header";
import { BottomNav } from "@/components/ui/bottom-nav";

// A fixed column: the header and bottom nav stay put and only the page content scrolls.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopGate>
      <div className="flex h-dvh flex-col overflow-hidden">
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-md px-4 pt-4 pb-nav">{children}</div>
        </main>
        <BottomNav />
      </div>
    </ShopGate>
  );
}