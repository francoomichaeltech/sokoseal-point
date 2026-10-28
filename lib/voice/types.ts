export type TranscriptResult =
  | { status: "OK"; transcript: string; latencyMs: number }
  | { status: "ERROR"; latencyMs: number };