import type { ScanResult } from "./types";

export async function requestScan(image: string): Promise<ScanResult> {
  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    return response.ok ? await response.json() : { status: "ERROR", latencyMs: 0 };
  } catch {
    return { status: "ERROR", latencyMs: 0 };
  }
}