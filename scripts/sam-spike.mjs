// Sends one local photo to the segmentation model with a concept prompt and
// prints latency and the returned boxes, to confirm the output format before
// building the grounding adapter.
// Usage: node --env-file=.env.local scripts/sam-spike.mjs <image> [concept]

import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Record shape from the SAM output protocol: id<|box;x1=..;y1=..;x2=..;y2=..;w=..;h=..|>
const BOX_PATTERN = /(\d+)<\|box;x1=([\d.]+);y1=([\d.]+);x2=([\d.]+);y2=([\d.]+);w=(\d+);h=(\d+)\|>/g;

const [imagePath, concept = "mug"] = process.argv.slice(2);
const mimeType = imagePath && MIME_TYPES[path.extname(imagePath).toLowerCase()];

if (!mimeType) {
  console.error("Usage: node --env-file=.env.local scripts/sam-spike.mjs <image.jpg|png|webp> [concept]");
  process.exit(1);
}

const client = new OpenAI({
  baseURL: process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1",
  apiKey: process.env.MODEL_API_KEY,
});

const image = await readFile(imagePath);
const started = Date.now();

const stream = await client.responses.create({
  model: process.env.META_SEGMENT_MODEL ?? "sam-3.1",
  input: [
    {
      type: "message",
      role: "user",
      content: [
        { type: "input_text", text: concept },
        { type: "input_image", image_url: `data:${mimeType};base64,${image.toString("base64")}` },
      ],
    },
  ],
  stream: true,
});

let output = "";
for await (const event of stream) {
  if (event.type === "response.output_text.delta") output += event.delta;
}

const boxes = [...output.matchAll(BOX_PATTERN)].map(([, id, x1, y1, x2, y2, w, h]) => ({
  id,
  x1: Number(x1),
  y1: Number(y1),
  x2: Number(x2),
  y2: Number(y2),
  space: `${w}x${h}`,
}));

console.log(`concept: "${concept}"`);
console.log(`elapsed: ${Date.now() - started} ms`);
console.log(`objects: ${boxes.length}`);
console.table(boxes);
// Mask payloads are long; elided so the line structure stays readable.
console.log(`raw: ${output.replace(/data=[^|]*/g, "data=…").trim() || "(empty)"}`);