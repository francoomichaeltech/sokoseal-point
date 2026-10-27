import { Wordmark } from "./wordmark";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface pt-safe">
      <div className="mx-auto flex h-(--header-height) max-w-md items-center px-4">
        <Wordmark />
      </div>
    </header>
  );
}