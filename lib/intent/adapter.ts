import { completeJson } from "@/lib/meta/spark";
import { fallbackParseIntent, formatTranscript, normalizeTranscript } from "./normalize";
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

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await completeJson(intentPrompt(normalized, products, pointCount), "shop_actions", INTENT_SCHEMA);
      const intent = parseIntent(raw);
      if (intent) {
        return {
          status: "OK",
          intent: {
            ...intent,
            transcript: formatTranscript(intent.transcript || normalized),
          },
          latencyMs: Date.now() - started,
        };
      }
    } catch (error) {
      if (attempt === 1) {
        console.error("[intent]", error instanceof Error ? error.message : error);
      }
    }
  }

  const fallback = fallbackParseIntent(normalized, products, pointCount ?? 0);
  return { status: "OK", intent: fallback, latencyMs: Date.now() - started };
}