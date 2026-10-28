import "server-only";
import OpenAI from "openai";

const TIMEOUT_MS = 20_000;

export type SparkContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

type Options = { effort?: "minimal" | "low" };

// Single request with a strict JSON schema. Returns the parsed JSON; callers validate it.
export async function completeJson(
  content: string | SparkContent[],
  name: string,
  schema: Record<string, unknown>,
  // Spike 01: minimal reasoning parsed every test transcript correctly in 2–3 s.
  { effort = "minimal" }: Options = {},
): Promise<unknown> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1",
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });

  const parts: SparkContent[] = typeof content === "string" ? [{ type: "input_text", text: content }] : content;
  // Images are sent without `detail`, the same shape as the verified SAM requests.
  const input = [{ type: "message", role: "user", content: parts }] as unknown as OpenAI.Responses.ResponseInput;

  const response = await client.responses.create({
    model: process.env.META_INTENT_MODEL ?? "muse-spark-1.3",
    input,
    text: { format: { type: "json_schema", name, schema, strict: true } },
    reasoning: { effort },
  });

  return JSON.parse(response.output_text);
}