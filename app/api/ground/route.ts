import { groundTap } from "@/lib/grounding/adapter";

const JPEG_PREFIX = "data:image/jpeg;base64,";
const MAX_IMAGE_CHARS = 3_000_000;

function isUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export async function POST(request: Request) {
  // Each call spends API credits, so only pages served from this host may call it.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const { image, x, y } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof image !== "string" ||
    !image.startsWith(JPEG_PREFIX) ||
    image.length > MAX_IMAGE_CHARS ||
    !isUnit(x) ||
    !isUnit(y)
  ) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  return Response.json(await groundTap(image, { x, y }));
}