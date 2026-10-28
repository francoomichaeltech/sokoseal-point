import { completeJson } from "@/lib/meta/spark";
import { identityContent, identitySchema } from "./prompt";
import { UNKNOWN, type IdentityResult, type ReferenceProduct } from "./types";
import { parseIdentity } from "./validate";

export async function identify(targets: string[], products: ReferenceProduct[]): Promise<IdentityResult> {
  const started = Date.now();
  if (targets.length === 0) return { status: "OK", matches: [], latencyMs: 0 };
  // With nothing to compare against, no object can be a shop product.
  if (products.length === 0) return { status: "OK", matches: targets.map(() => UNKNOWN), latencyMs: 0 };

  const skus = products.map((product) => product.sku);

  try {
    const raw = await completeJson(
      identityContent(targets, products),
      "identify_products",
      identitySchema(skus, targets.length),
      { effort: "low" },
    );
    const matches = parseIdentity(raw, skus, targets.length);
    if (!matches) {
      console.error("[identify] model output failed validation");
      return { status: "ERROR", latencyMs: Date.now() - started };
    }
    return { status: "OK", matches, latencyMs: Date.now() - started };
  } catch (error) {
    console.error("[identify]", error instanceof Error ? error.message : error);
    return { status: "ERROR", latencyMs: Date.now() - started };
  }
}