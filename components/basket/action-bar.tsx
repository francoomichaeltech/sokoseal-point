import type { ReactNode } from "react";

// Fixed above the bottom nav, so the main actions never move with the page.
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="form-actions fixed inset-x-0 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom))] z-10 border-t border-line bg-canvas">
      <div className="mx-auto flex max-w-md gap-3 px-4 py-3">{children}</div>
    </div>
  );
}