import type { IntentResult } from "./types";

export async function requestIntent(transcript: string): Promise<IntentResult> {
  try {
    const response = await fetch("/api/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    return response.ok ? await response.json() : { status: "ERROR", latencyMs: 0 };
  } catch {
    return { status: "ERROR", latencyMs: 0 };
  }
}