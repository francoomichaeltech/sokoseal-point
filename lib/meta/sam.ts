import "server-only";
import OpenAI from "openai";

const TIMEOUT_MS = 15_000;

// Returns the raw output text of the segmentation model for one image and one concept.
export async function segment(imageDataUrl: string, concept: string): Promise<string> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("MODEL_API_KEY is not set");

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1",
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });

  // Same request shape as scripts/sam-spike.mjs. The SDK types also require `detail`
  // on images; it is left out so the request matches what was verified.
  const input = [
    {
      type: "message",
      role: "user",
      content: [
        { type: "input_text", text: concept },
        { type: "input_image", image_url: imageDataUrl },
      ],
    },
  ] as unknown as OpenAI.Responses.ResponseInput;

  const stream = await client.responses.create({
    model: process.env.META_SEGMENT_MODEL ?? "sam-3.1",
    input,
    stream: true,
  });

  let output = "";
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") output += event.delta;
  }
  return output;
}