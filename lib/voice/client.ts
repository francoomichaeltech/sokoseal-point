import type { TranscriptResult } from "./types";

export async function requestTranscript(wav: Blob, keywords: string[]): Promise<TranscriptResult> {
  const form = new FormData();
  form.append("audio", wav, "speech.wav");
  form.append("keywords", JSON.stringify(keywords));

  try {
    const response = await fetch("/api/transcribe", { method: "POST", body: form });
    return response.ok ? await response.json() : { status: "ERROR", latencyMs: 0 };
  } catch {
    return { status: "ERROR", latencyMs: 0 };
  }
}