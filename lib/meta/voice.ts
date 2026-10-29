import "server-only";
import type { TranscriptResult } from "@/lib/voice/types";

const TIMEOUT_MS = 60_000;

// One-shot transcription in push-to-talk mode. Keywords bias recognition; they do not restrict it.
export async function transcribe(wav: Blob, keywords: string[] = []): Promise<TranscriptResult> {
  const started = Date.now();
  const failed = (reason: string): TranscriptResult => {
    console.error("[transcribe]", reason);
    return { status: "ERROR", latencyMs: Date.now() - started };
  };

  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) return failed("MODEL_API_KEY is not set");

  const settings = {
    model: process.env.META_VOICE_MODEL ?? "muse-voice-transcribe-1.0",
    audioEncoding: "WAV",
    mode: "PUSH_TO_TALK",
    ...(keywords.length > 0 ? { keywords } : {}),
  };

  const form = new FormData();
  form.append("request", new Blob([JSON.stringify(settings)], { type: "application/json" }));
  form.append("audio", wav, "speech.wav");

  try {
    const response = await fetch(`${process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1"}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return failed(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }

    const body: unknown = await response.json();
    const transcript = (body as { transcript?: unknown } | null)?.transcript;
    if (typeof transcript !== "string") return failed("response has no transcript");

    return { status: "OK", transcript: transcript.trim(), latencyMs: Date.now() - started };
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }
}