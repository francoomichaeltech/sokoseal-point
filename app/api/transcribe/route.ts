import { isSameOrigin } from "@/lib/http/same-origin";
import { isWav } from "@/lib/media/wav";
import { transcribe } from "@/lib/meta/voice";

// 2 min of 16 kHz 16-bit mono is about 3.8 MB, under Vercel's 4.5 MB body limit.
const MAX_AUDIO_BYTES = 4_000_000;
const MAX_KEYWORDS = 50;
const MAX_KEYWORD_LENGTH = 40;

function parseKeywords(raw: FormDataEntryValue | null): string[] | null {
  if (raw === null) return [];
  if (typeof raw !== "string") return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_KEYWORDS) return null;

    const keywords: string[] = [];
    for (const item of value) {
      if (typeof item !== "string" || !item.trim() || item.length > MAX_KEYWORD_LENGTH) return null;
      keywords.push(item.trim());
    }
    return keywords;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid form" }, { status: 400 });
  }

  const audio = form.get("audio");
  const keywords = parseKeywords(form.get("keywords"));

  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES || keywords === null) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  const header = new Uint8Array(await audio.slice(0, 12).arrayBuffer());
  if (!isWav(header)) {
    return Response.json({ error: "audio must be WAV" }, { status: 400 });
  }

  return Response.json(await transcribe(audio, keywords));
}