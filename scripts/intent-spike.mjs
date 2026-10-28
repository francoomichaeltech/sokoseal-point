// Sends a transcript to Muse Spark (text only) and prints the shop actions as strict JSON.
// Usage: node --env-file=.env.local scripts/intent-spike.mjs "transcript"

import OpenAI from "openai";

const transcript = process.argv[2];
if (!transcript) {
  console.error('Usage: node --env-file=.env.local scripts/intent-spike.mjs "transcript"');
  process.exit(1);
}

const INSTRUCTIONS = `A person at a shop counter said the transcript below while pointing at products. It is usually Kiswahili, sometimes English or mixed.

Return one action for every request, in spoken order. Never merge two requests or drop one.
- action: ADD (nipe, nataka, naomba, ongeza, give me, I want), REMOVE (ondoa, toa, punguza, remove), SET (ziwe, iwe, weka ... tu, make that).
- quantity: integer. Singular "hii"/"this" with no number is 1. A corrected number uses the final one. Vague amounts, zero, money amounts, or SET without a number give null.
- reference: POINT for hii, hiki, hizi, ile, kile, zile, this, these, that, those. SAME for hiyo, hizo, hilo, it, make that, or a follow-on like "kisha ongeza tano". NAMED when a product is named without pointing.
- named_product: the name as spoken, or null. spoken: the words of this action.
Greetings and price questions are not actions. Never invent products or prices.

Reference examples (patterns only):
"Nipe hii mbili." -> ADD 2 POINT
"Nataka hizi mbili, na ile moja." -> ADD 2 POINT; ADD 1 POINT
"Nipe hii tano, hapana, ziwe tatu." -> ADD 3 POINT
"Ondoa moja kwa hii, kisha ongeza tano." -> REMOVE 1 POINT; ADD 5 SAME
"Naomba vikombe viwili." -> ADD 2 NAMED "vikombe"
"Two of these and one of that." -> ADD 2 POINT; ADD 1 POINT
"Mambo, bei gani hii?" -> no actions`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["actions", "needs_clarification"],
  properties: {
    needs_clarification: { type: "boolean" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "quantity", "reference", "named_product", "spoken"],
        properties: {
          action: { type: "string", enum: ["ADD", "REMOVE", "SET"] },
          quantity: { type: ["integer", "null"] },
          reference: { type: "string", enum: ["POINT", "SAME", "NAMED"] },
          named_product: { type: ["string", "null"] },
          spoken: { type: "string" },
        },
      },
    },
  },
};

const client = new OpenAI({
  baseURL: process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1",
  apiKey: process.env.MODEL_API_KEY,
});

const started = Date.now();
const response = await client.responses.create({
  model: process.env.META_INTENT_MODEL ?? "muse-spark-1.3",
  input: [{ type: "message", role: "user", content: [{ type: "input_text", text: `${INSTRUCTIONS}\n\nTranscript: "${transcript}"` }] }],
  text: { format: { type: "json_schema", name: "shop_actions", schema: SCHEMA, strict: true } },
  reasoning: { effort: process.env.REASONING_EFFORT ?? "minimal" },
});

console.log(`model ${Date.now() - started} ms · usage ${JSON.stringify(response.usage)}`);
console.log(JSON.stringify(JSON.parse(response.output_text), null, 2));