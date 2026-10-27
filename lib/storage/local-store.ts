import { useSyncExternalStore } from "react";

export type LocalStore<T> = {
  get: () => T;
  set: (value: T | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createLocalStore<T>(key: string, parse: (raw: string | null) => T): LocalStore<T> {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedValue: T;

  function get(): T {
    const raw = localStorage.getItem(key);
    // useSyncExternalStore needs the same reference while the stored value is unchanged.
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = parse(raw);
    }
    return cachedValue;
  }

  function set(value: T | null) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    // Keeps other open tabs in sync.
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };

    listeners.add(listener);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { get, set, subscribe };
}

// Returns undefined until the value has been read on the client.
export function useLocalStore<T>(store: LocalStore<T>): T | undefined {
  return useSyncExternalStore(store.subscribe, store.get, () => undefined);
}