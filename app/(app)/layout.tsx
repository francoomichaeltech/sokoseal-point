import { ShopGate } from "@/components/shop/shop-gate";
import { AppHeader } from "@/components/ui/app-header";
import { BottomNav } from "@/components/ui/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopGate>
      <AppHeader />
      <main className="mx-auto max-w-md px-4 pt-4 pb-nav">{children}</main>
      <BottomNav />
    </ShopGate>
  );
}