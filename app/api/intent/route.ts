import { isSameOrigin } from "@/lib/http/same-origin";
import { resolveIntent } from "@/lib/intent/adapter";

// About 15 s of speech; anything longer did not come from one hold.
const MAX_TRANSCRIPT_CHARS = 500;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let transcript: unknown;
  try {
    ({ transcript } = await request.json());
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (typeof transcript !== "string" || transcript.length > MAX_TRANSCRIPT_CHARS) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  return Response.json(await resolveIntent(transcript));
}