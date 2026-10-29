"use client";

import { useSyncExternalStore } from "react";
import type { PointedTarget } from "@/lib/commerce/types";
import type { IntentAction } from "@/lib/intent/types";
import type { PointedMark } from "@/lib/pointing/locate";

/** The latest hold, waiting for the user to review it in the basket. */
export type HoldRequest =
  | { eventId: string; phase: "processing" }
  | { eventId: string; phase: "error" }
  | {
      eventId: string;
      phase: "ready";
      heard: string;
      transcript: string;
      actions: IntentAction[];
      needsClarification: boolean;
      targets: PointedTarget[];
      pointed: number;
      objectCount: number;
      /** False when the camera never saw a hand during the hold. */
      handSeen: boolean;
      marks: PointedMark[];
    };

// Kept in memory: a request is reviewed right after the hold and is not worth restoring after a reload.
let current: HoldRequest | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRequest(): HoldRequest | null {
  return current;
}

export function setRequest(next: HoldRequest | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

// Results from an older hold never overwrite a newer one.
export function updateRequest(eventId: string, next: HoldRequest) {
  if (current?.eventId === eventId) setRequest(next);
}

export function clearRequest() {
  setRequest(null);
}

export function useRequest(): HoldRequest | null {
  return useSyncExternalStore(subscribe, getRequest, () => null);
}