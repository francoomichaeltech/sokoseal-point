import { isSameOrigin } from "@/lib/http/same-origin";
import { resolveIntent } from "@/lib/intent/adapter";

// About 2 min of speech; anything longer did not come from one hold.
const MAX_TRANSCRIPT_CHARS = 3_000;
const MAX_PRODUCTS = 50;
const MAX_PRODUCT_LENGTH = 40;
const MAX_POINTS = 20;

function parseProducts(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PRODUCTS) return null;

  const products: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.length > MAX_PRODUCT_LENGTH) return null;
    products.push(item.trim());
  }
  return products;
}

// undefined means invalid; null means the client did not report pointing.
function parsePointCount(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_POINTS
    ? value
    : undefined;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const transcript = body?.transcript;
  const products = parseProducts(body?.products);
  const pointCount = parsePointCount(body?.pointCount);

  if (
    typeof transcript !== "string" ||
    transcript.length > MAX_TRANSCRIPT_CHARS ||
    products === null ||
    pointCount === undefined
  ) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  return Response.json(await resolveIntent(transcript, products, pointCount));
}