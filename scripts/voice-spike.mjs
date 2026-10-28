// Sends a WAV recording to the one-shot transcription endpoint and prints the raw response.
// Usage: node --env-file=.env.local scripts/voice-spike.mjs <recording.wav> [language|auto] [keyword ...]

import { readFile } from "node:fs/promises";
import path from "node:path";

const [audioPath, language = "auto", ...keywords] = process.argv.slice(2);

if (!audioPath) {
  console.error("Usage: node --env-file=.env.local scripts/voice-spike.mjs <recording.wav> [language|auto] [keyword ...]");
  process.exit(1);
}

const settings = {
  model: process.env.META_VOICE_MODEL ?? "muse-voice-transcribe-1.0",
  audioEncoding: "WAV",
  mode: "PUSH_TO_TALK",
  ...(language !== "auto" ? { languageBias: [language] } : {}),
  ...(keywords.length > 0 ? { keywords } : {}),
};

const form = new FormData();
form.append("request", new Blob([JSON.stringify(settings)], { type: "application/json" }));
form.append("audio", new Blob([await readFile(audioPath)], { type: "audio/wav" }), path.basename(audioPath));

const started = Date.now();
const response = await fetch(`${process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1"}/asr/transcribe`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}`, Accept: "application/json" },
  body: form,
});

const body = await response.text();
console.log(`${path.basename(audioPath)} · language: ${language} · keywords: ${keywords.join(", ") || "none"}`);
console.log(`HTTP ${response.status} in ${Date.now() - started} ms`);
try {
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
  console.log(body);
}