import "server-only";
import OpenAI from "openai";

const TIMEOUT_MS = 15_000;

// Text-only request with a strict JSON schema. Returns the parsed JSON; callers validate it.
export async function completeJson(
  prompt: string,
  name: string,
  schema: Record<string, unknown>,
): Promise<unknown> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1",
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });

  const response = await client.responses.create({
    model: process.env.META_INTENT_MODEL ?? "muse-spark-1.3",
    input: [{ type: "message", role: "user", content: [{ type: "input_text", text: prompt }] }],
    text: { format: { type: "json_schema", name, schema, strict: true } },
    // Spike 01: minimal reasoning parsed every test transcript correctly in 2–3 s.
    reasoning: { effort: "minimal" },
  });

  return JSON.parse(response.output_text);
}