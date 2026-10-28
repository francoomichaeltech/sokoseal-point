// Uploads a short MP4 clip to Muse Spark and prints the shop actions it reads from the
// pointing and speech, as strict JSON. Used to check transcript quality, timing and
// pointing accuracy before building /api/understand.
// Usage: node --env-file=.env.local scripts/understand-spike.mjs <clip.mp4> ["transcript"]

import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";

const [clipPath, transcript] = process.argv.slice(2);

if (!clipPath || path.extname(clipPath).toLowerCase() !== ".mp4") {
  console.error('Usage: node --env-file=.env.local scripts/understand-spike.mjs <clip.mp4> ["transcript"]');
  process.exit(1);
}

const INSTRUCTIONS = `You watch a short phone video recorded at a shop counter. A person points at products with a finger and says what they want, usually in Kiswahili, sometimes in English or a mix of both.

Return the basket actions they asked for, in the order they said them.
- action: ADD (nipe, nataka, naomba, ongeza, give me, I want), REMOVE (ondoa, toa, punguza, remove, take off), SET (ziwe, iwe, weka ... tu, make that, change it to).
- quantity: the spoken number as an integer. A singular "hii" or "this" with no number is 1. If the speaker corrects the number, use the final one. Vague amounts (kadhaa, chache, some, a few), zero, money amounts, or SET without a number give null.
- reference: POINT when the words refer to something being pointed at (hii, hiki, hizi, ile, kile, zile, this, these, that, those). SAME when the words refer back to the previous action's product (hiyo, hizo, hilo, it, make that). NAMED when the product is named without pointing (vikombe viwili, two mugs).
- named_product: the product name as spoken, or null.
- spoken: the exact words of this action.
- For POINT only: point_time is the time in seconds of the frame where the finger is aimed at the product meant by these words. point_x and point_y are a location on that product in that frame, from 0 to 1, with 0,0 at the top-left. Give a point on the product the finger is aimed at, not on the fingertip. Otherwise all three are null.

Rules:
- Never invent products, prices or SKUs, and do not decide whether a product is sold here.
- Greetings, questions and price questions (bei gani, how much) are not actions.
- If the speech or the pointing is unclear, return only the actions you are sure of and set needs_clarification to true.
- transcript is everything said, in the original language.

Reference examples. These show the patterns only; the clip decides.
"Nipe hii mbili." -> ADD 2 POINT
"Nataka hizi mbili, na ile moja." -> ADD 2 POINT; ADD 1 POINT
"Nipe hii tano, hapana, ziwe tatu." -> ADD 3 POINT
"Ondoa moja kwa hizi." -> REMOVE 1 POINT
"Naomba vikombe viwili na kalamu moja." -> ADD 2 NAMED "vikombe"; ADD 1 NAMED "kalamu"
"Could I get two of this?" -> ADD 2 POINT
"Two of these and one of that." -> ADD 2 POINT; ADD 1 POINT
"Mambo, bei gani hii?" -> no actions`;

const nullable = (type) => ({ type: [type, "null"] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["transcript", "language", "actions", "needs_clarification"],
  properties: {
    transcript: { type: "string" },
    language: { type: "string", enum: ["sw", "en", "mixed", "other", "none"] },
    needs_clarification: { type: "boolean" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "quantity", "reference", "named_product", "spoken", "point_time", "point_x", "point_y"],
        properties: {
          action: { type: "string", enum: ["ADD", "REMOVE", "SET"] },
          quantity: nullable("integer"),
          reference: { type: "string", enum: ["POINT", "SAME", "NAMED"] },
          named_product: nullable("string"),
          spoken: { type: "string" },
          point_time: nullable("number"),
          point_x: nullable("number"),
          point_y: nullable("number"),
        },
      },
    },
  },
};

const client = new OpenAI({
  baseURL: process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1",
  apiKey: process.env.MODEL_API_KEY,
});

const prompt = transcript
  ? `${INSTRUCTIONS}\n\nA speech-to-text transcript of this clip: "${transcript}". Trust it for the words and use the video for the pointing.`
  : INSTRUCTIONS;

const started = Date.now();
const file = await client.files.create({
  file: await toFile(await readFile(clipPath), path.basename(clipPath), { type: "video/mp4" }),
  purpose: "user_data",
});
const uploaded = Date.now();

try {
  const response = await client.responses.create({
    model: process.env.META_INTENT_MODEL ?? "muse-spark-1.3",
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_file", file_id: file.id },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "shop_actions", schema: SCHEMA, strict: true } },
    reasoning: { effort: "low" },
  });

  console.log(`${path.basename(clipPath)} · transcript given: ${transcript ? "yes" : "no"}`);
  console.log(`upload ${uploaded - started} ms · model ${Date.now() - uploaded} ms`);
  console.log(`usage ${JSON.stringify(response.usage)}`);
  try {
    console.log(JSON.stringify(JSON.parse(response.output_text), null, 2));
  } catch {
    console.log(response.output_text);
  }
} finally {
  // Uploaded clips count toward team storage; nothing here needs them again.
  try {
    await client.files.delete(file.id);
  } catch {
    console.warn(`could not delete ${file.id}`);
  }
}