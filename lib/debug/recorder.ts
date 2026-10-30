import { createStore, del, entries, get, set, clear } from "idb-keyval";
import { useSyncExternalStore } from "react";
import type { Product } from "@/lib/catalogue/types";
import type { Outcome, PointedTarget } from "@/lib/commerce/types";
import type { Box, ScanResult } from "@/lib/grounding/types";
import type { IntentAction } from "@/lib/intent/types";
import type { Frame } from "@/lib/media/capture";
import type { PointedMark } from "@/lib/pointing/locate";
import type { TraceSample } from "@/lib/pointing/trace";

const STORAGE_KEY = "sokoseal.debug.recorder";
const listeners = new Set<() => void>();

export type MeantTarget = string | "nothing" | "not_in_shop";

export type HoldAnnotation = {
  status: "correct" | "wrong";
  /** For each action or pointed request: SKU, "nothing", or "not_in_shop" */
  meantProducts: MeantTarget[];
  notes?: string;
  annotatedAt: number;
};

export type RecordedHold = {
  id: string;
  createdAt: number;
  holdStartMs: number;
  holdEndMs: number;
  durationMs: number;
  frameUrl: string;
  frameWidth: number;
  frameHeight: number;
  samBoxes: Box[];
  samples: TraceSample[];
  identities: {
    box: Box;
    state: string;
    sku?: string;
    name?: string | null;
  }[];
  transcript: string;
  heard: string;
  intent: {
    transcript: string;
    actions: IntentAction[];
    needsClarification: boolean;
  } | null;
  pairedTargets: PointedTarget[];
  marks: PointedMark[];
  outcomes: Outcome[];
  products: Product[];
  latencies: {
    scanMs?: number;
    transcribeMs?: number;
    identifyMs?: number;
    intentMs?: number;
    totalMs?: number;
  };
  annotation?: HoldAnnotation;
};

type PendingHold = {
  eventId: string;
  holdStartMs: number;
  holdEndMs?: number;
  durationMs?: number;
  samples?: TraceSample[];
  frameUrl?: string;
  frameWidth?: number;
  frameHeight?: number;
  samBoxes?: Box[];
  products?: Product[];
  scanMs?: number;
  scanPromise?: Promise<{ result: ScanResult; frame: Frame }>;
};

const pendingHolds = new Map<string, PendingHold>();

// Lazy creation of IDB store so it only runs in the browser.
let idbStore: ReturnType<typeof createStore> | null = null;
function getStore() {
  if (typeof window === "undefined") return null;
  idbStore ??= createStore("sokoseal-recordings", "holds");
  return idbStore;
}

export function isRecorderEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setRecorderEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useRecorderEnabled(): boolean {
  return useSyncExternalStore(subscribe, isRecorderEnabled, () => false);
}

/** Called when hold starts to record starting timestamp. */
export function recordHoldStart(eventId: string) {
  try {
    if (!isRecorderEnabled()) return;
    pendingHolds.set(eventId, {
      eventId,
      holdStartMs: performance.now(),
    });
  } catch (error) {
    console.warn("[recorder] recordHoldStart error:", error);
  }
}

/** Called when hold ends with samples, scan promise and catalogue snapshot. */
export function recordHoldEnd({
  eventId,
  samples,
  scanPromise,
  products,
  durationMs,
}: {
  eventId: string;
  samples: TraceSample[];
  scanPromise: Promise<{ result: ScanResult; frame: Frame }> | null;
  products: Product[];
  durationMs: number;
}) {
  try {
    if (!isRecorderEnabled()) return;
    const existing = pendingHolds.get(eventId) ?? { eventId, holdStartMs: performance.now() - durationMs };
    existing.holdEndMs = performance.now();
    existing.durationMs = durationMs;
    // Strictly preserve original samples without mutation
    existing.samples = [...samples];
    existing.products = [...products];

    if (scanPromise) {
      existing.scanPromise = scanPromise;
      // Read-only observation of the existing scan promise
      void scanPromise
        .then((scan) => {
          if (!scan) return;
          if (scan.frame) {
            existing.frameUrl = scan.frame.url;
            existing.frameWidth = scan.frame.width;
            existing.frameHeight = scan.frame.height;
          }
          if (scan.result?.status === "OK") {
            existing.samBoxes = [...scan.result.boxes];
            existing.scanMs = scan.result.latencyMs;
          }
        })
        .catch(() => {});
    }

    pendingHolds.set(eventId, existing);
  } catch (error) {
    console.warn("[recorder] recordHoldEnd error:", error);
  }
}

/** Called when hold finishes processing and results are ready. Persists complete record to IndexedDB. */
export async function recordHoldReady({
  eventId,
  heard,
  transcript,
  actions,
  needsClarification,
  targets,
  marks,
  outcomes,
}: {
  eventId: string;
  heard: string;
  transcript: string;
  actions: IntentAction[];
  needsClarification: boolean;
  targets: PointedTarget[];
  marks: PointedMark[];
  outcomes: Outcome[];
}): Promise<void> {
  try {
    if (!isRecorderEnabled()) return;
    const store = getStore();
    if (!store) return;

    const pending = pendingHolds.get(eventId);
    const now = performance.now();

    // If scan promise is still pending, wait for it with a 3s timeout
    if (pending?.scanPromise && !pending.samBoxes) {
      try {
        const scan = await Promise.race([
          pending.scanPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (scan?.frame) {
          pending.frameUrl = scan.frame.url;
          pending.frameWidth = scan.frame.width;
          pending.frameHeight = scan.frame.height;
        }
        if (scan?.result?.status === "OK") {
          pending.samBoxes = [...scan.result.boxes];
          pending.scanMs = scan.result.latencyMs;
        }
      } catch {
        // Continue with whatever was captured
      }
    }

    const identities = marks
      .filter((mark) => mark.box !== null)
      .map((mark) => ({
        box: mark.box!,
        state: mark.target.state,
        sku: mark.target.state === "product" ? mark.target.sku : undefined,
        name: mark.name,
      }));

    const record: RecordedHold = {
      id: eventId,
      createdAt: Date.now(),
      holdStartMs: pending?.holdStartMs ?? now,
      holdEndMs: pending?.holdEndMs ?? now,
      durationMs: pending?.durationMs ?? 0,
      frameUrl: pending?.frameUrl ?? "",
      frameWidth: pending?.frameWidth ?? 0,
      frameHeight: pending?.frameHeight ?? 0,
      samBoxes: pending?.samBoxes ?? [],
      samples: pending?.samples ?? [],
      identities,
      transcript,
      heard,
      intent: {
        transcript,
        actions,
        needsClarification,
      },
      pairedTargets: targets,
      marks,
      outcomes,
      products: pending?.products ?? [],
      latencies: {
        scanMs: pending?.scanMs,
        // Note: transcribeMs and intentMs are omitted because run-hold.ts is in the matching path
        // and cannot be modified to pass them through. We do not invent or fake them.
        totalMs: pending ? Math.round(now - pending.holdStartMs) : undefined,
      },
    };

    await set(eventId, record, store);
    pendingHolds.delete(eventId);
  } catch (error) {
    console.warn("[recorder] recordHoldReady error:", error);
  }
}

/** Saves user ground truth annotation on a recorded hold. */
export async function updateHoldAnnotation(
  eventId: string,
  annotation: {
    status: "correct" | "wrong";
    meantProducts: MeantTarget[];
    notes?: string;
  },
): Promise<void> {
  const store = getStore();
  if (!store) return;

  const record = (await get<RecordedHold>(eventId, store)) as RecordedHold | undefined;
  if (!record) return;

  record.annotation = {
    ...annotation,
    annotatedAt: Date.now(),
  };

  await set(eventId, record, store);
}

export async function getRecordedHolds(): Promise<RecordedHold[]> {
  const store = getStore();
  if (!store) return [];

  const allEntries = (await entries<string, RecordedHold>(store)) as [string, RecordedHold][];
  return allEntries
    .map(([, hold]) => hold)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRecordedHold(id: string): Promise<RecordedHold | undefined> {
  const store = getStore();
  if (!store) return undefined;
  return get<RecordedHold>(id, store);
}

export async function deleteRecordedHold(id: string): Promise<void> {
  const store = getStore();
  if (!store) return;
  await del(id, store);
}

export async function clearRecordedHolds(): Promise<void> {
  const store = getStore();
  if (!store) return;
  await clear(store);
}

export async function exportRecordingsJson(): Promise<string> {
  const holds = await getRecordedHolds();
  return JSON.stringify(holds, null, 2);
}

export function downloadRecordingsBlob(jsonString: string, filename?: string) {
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `sokoseal-recordings-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
