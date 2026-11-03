import { completeJson } from "@/lib/meta/spark";
import { normalizeTranscript } from "./normalize";
import { INTENT_SCHEMA, intentPrompt } from "./prompt";
import type { IntentResult } from "./types";
import { parseIntent } from "./validate";

export async function resolveIntent(
  transcript: string,
  products: string[] = [],
  pointCount: number | null = null,
): Promise<IntentResult> {
  const started = Date.now();
  const normalized = normalizeTranscript(transcript, products);
  if (!normalized) {
    return { status: "OK", intent: { transcript: "", actions: [], needsClarification: false }, latencyMs: 0 };
  }

  try {
    const raw = await completeJson(intentPrompt(normalized, products, pointCount), "shop_actions", INTENT_SCHEMA);
    const intent = parseIntent(raw);
    if (!intent) {
      console.error("[intent] model output failed validation");
      return { status: "ERROR", latencyMs: Date.now() - started };
    }
    return { status: "OK", intent, latencyMs: Date.now() - started };
  } catch (error) {
    console.error("[intent]", error instanceof Error ? error.message : error);
    return { status: "ERROR", latencyMs: Date.now() - started };
  }
}