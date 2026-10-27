"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Frame } from "@/lib/media/capture";
import type { GroundingResult, Pointer } from "./types";

export type GroundingState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "done"; result: GroundingResult };

export function useGrounding() {
  const [state, setState] = useState<GroundingState>({ phase: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ phase: "idle" });
  }, []);

  const ground = useCallback(async (frame: Frame, pointer: Pointer) => {
    // A new gesture replaces any request still in flight.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ phase: "checking" });

    let result: GroundingResult;
    try {
      const response = await fetch("/api/ground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: frame.url,
          x: pointer.tip.x,
          y: pointer.tip.y,
          dx: pointer.direction?.x,
          dy: pointer.direction?.y,
          hand: pointer.hand,
        }),
        signal: controller.signal,
      });
      result = response.ok ? await response.json() : { status: "ERROR" };
    } catch {
      result = { status: "ERROR" };
    }

    if (!controller.signal.aborted) setState({ phase: "done", result });
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, ground, clear };
}