// Verifies the API key, lists the models available to this account,
// and sends one small request to the intent model.
// Usage: node --env-file=.env.local scripts/check-api.mjs

const baseUrl = process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1";
const apiKey = process.env.MODEL_API_KEY;
const intentModel = process.env.META_INTENT_MODEL ?? "muse-spark-1.3";

if (!apiKey) {
  console.error("MODEL_API_KEY is not set. Add it to .env.local.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

async function request(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  const models = await request("/models");
  console.log("Available models:");
  for (const model of models.data) console.log(`  ${model.id}`);

  const started = Date.now();
  const completion = await request("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: intentModel,
      messages: [{ role: "user", content: "Reply with the single word: ready" }],
      reasoning_effort: "low",
    }),
  });

  const reply = completion.choices[0].message.content.trim();
  console.log(`\n${intentModel} replied "${reply}" in ${Date.now() - started} ms`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});