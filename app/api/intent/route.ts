import { isSameOrigin } from "@/lib/http/same-origin";
import { resolveIntent } from "@/lib/intent/adapter";

// About 15 s of speech; anything longer did not come from one hold.
const MAX_TRANSCRIPT_CHARS = 500;
const MAX_PRODUCTS = 50;
const MAX_PRODUCT_LENGTH = 40;

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

  const { transcript } = body ?? {};
  const products = parseProducts(body?.products);
  if (typeof transcript !== "string" || transcript.length > MAX_TRANSCRIPT_CHARS || products === null) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  return Response.json(await resolveIntent(transcript, products));
}