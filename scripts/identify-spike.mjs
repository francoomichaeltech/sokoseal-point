// Tries image request shapes against Muse Spark and prints which ones the API accepts,
// with the API error for the ones it rejects.
// Usage: node --env-file=.env.local scripts/identify-spike.mjs <reference.jpg> <crop.jpg>

import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";

const [referencePath, cropPath] = process.argv.slice(2);
if (!referencePath || !cropPath) {
  console.error("Usage: node --env-file=.env.local scripts/identify-spike.mjs <reference.jpg> <crop.jpg>");
  process.exit(1);
}

const client = new OpenAI({
  baseURL: process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1",
  apiKey: process.env.MODEL_API_KEY,
  maxRetries: 0,
});
const model = process.env.META_INTENT_MODEL ?? "muse-spark-1.3";

const dataUrl = async (file) => `data:image/jpeg;base64,${(await readFile(file)).toString("base64")}`;
const reference = await dataUrl(referencePath);
const crop = await dataUrl(cropPath);

const prompt =
  "The first image is a reference photo of product MUG1. Does the second image show the same product? " +
  'Answer MUG1 if it does, otherwise "unknown".';

const schema = (withEnum) => ({
  type: "object",
  additionalProperties: false,
  required: ["T1"],
  properties: { T1: withEnum ? { type: "string", enum: ["MUG1", "unknown"] } : { type: "string" } },
});

async function attempt(name, images, withEnum = true) {
  const started = Date.now();
  try {
    const response = await client.responses.create({
      model,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: prompt }, ...images] }],
      text: { format: { type: "json_schema", name: "check", schema: schema(withEnum), strict: true } },
      reasoning: { effort: "low" },
    });
    console.log(`✓ ${name} · ${Date.now() - started} ms · ${response.output_text}`);
  } catch (error) {
    console.log(`✗ ${name} · ${Date.now() - started} ms · HTTP ${error.status ?? "-"} · ${error.message}`);
  }
}

await attempt("A data URL, enum schema", [
  { type: "input_image", image_url: reference },
  { type: "input_image", image_url: crop },
]);
await attempt("B data URL with detail auto", [
  { type: "input_image", image_url: reference, detail: "auto" },
  { type: "input_image", image_url: crop, detail: "auto" },
]);
await attempt(
  "C data URL, plain string schema",
  [
    { type: "input_image", image_url: reference },
    { type: "input_image", image_url: crop },
  ],
  false,
);

// Uploaded images are deleted afterwards; they count toward team storage.
const uploaded = [];
try {
  for (const file of [referencePath, cropPath]) {
    const content = await toFile(await readFile(file), path.basename(file), { type: "image/jpeg" });
    uploaded.push(await client.files.create({ file: content, purpose: "user_data" }));
  }
  await attempt("D uploaded file as input_image", [
    { type: "input_image", file_id: uploaded[0].id },
    { type: "input_image", file_id: uploaded[1].id },
  ]);
  await attempt("E uploaded file as input_file", [
    { type: "input_file", file_id: uploaded[0].id },
    { type: "input_file", file_id: uploaded[1].id },
  ]);
} catch (error) {
  console.log(`✗ upload · HTTP ${error.status ?? "-"} · ${error.message}`);
} finally {
  for (const file of uploaded) await client.files.delete(file.id).catch(() => {});
}