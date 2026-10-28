import { completeJson } from "@/lib/meta/spark";
import { INTENT_SCHEMA, intentPrompt } from "./prompt";
import type { IntentResult } from "./types";
import { parseIntent } from "./validate";

export async function resolveIntent(transcript: string): Promise<IntentResult> {
  const started = Date.now();
  if (!transcript.trim()) {
    return { status: "OK", intent: { actions: [], needsClarification: false }, latencyMs: 0 };
  }

  try {
    const intent = parseIntent(await completeJson(intentPrompt(transcript), "shop_actions", INTENT_SCHEMA));
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