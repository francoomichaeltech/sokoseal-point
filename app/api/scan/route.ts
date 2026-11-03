import { scanObjects } from "@/lib/grounding/adapter";
import { isSameOrigin } from "@/lib/http/same-origin";

const JPEG_PREFIX = "data:image/jpeg;base64,";
const MAX_IMAGE_CHARS = 3_000_000;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let image: unknown;
  try {
    ({ image } = await request.json());
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (typeof image !== "string" || !image.startsWith(JPEG_PREFIX) || image.length > MAX_IMAGE_CHARS) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  return Response.json(await scanObjects(image));
}