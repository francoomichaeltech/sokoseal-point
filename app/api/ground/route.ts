import { ground } from "@/lib/grounding/adapter";
import type { Box, Pointer } from "@/lib/grounding/types";

const JPEG_PREFIX = "data:image/jpeg;base64,";
const MAX_IMAGE_CHARS = 3_000_000;

function isUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isDirection(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -1 && value <= 1;
}

function isBox(value: unknown): value is Box {
  if (typeof value !== "object" || value === null) return false;
  const { x1, y1, x2, y2 } = value as Record<string, unknown>;
  return isUnit(x1) && isUnit(y1) && isUnit(x2) && isUnit(y2) && x1 <= x2 && y1 <= y2;
}

function parsePointer(fields: Record<string, unknown>): Pointer | null {
  const { x, y, dx, dy, hand } = fields;
  if (!isUnit(x) || !isUnit(y)) return null;

  const pointer: Pointer = { tip: { x, y } };

  if (dx !== undefined || dy !== undefined) {
    if (!isDirection(dx) || !isDirection(dy)) return null;
    pointer.direction = { x: dx, y: dy };
  }

  if (hand !== undefined) {
    if (!isBox(hand)) return null;
    pointer.hand = hand;
  }

  return pointer;
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

  const fields = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const { image } = fields;
  const pointer = parsePointer(fields);

  if (
    typeof image !== "string" ||
    !image.startsWith(JPEG_PREFIX) ||
    image.length > MAX_IMAGE_CHARS ||
    !pointer
  ) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  return Response.json(await ground(image, pointer));
}