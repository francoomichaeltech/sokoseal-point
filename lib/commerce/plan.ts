import type { Product } from "@/lib/catalogue/types";
import type { IntentAction } from "@/lib/intent/types";
import type { BasketLine, Outcome, PointedTarget, RejectReason } from "./types";

export const MAX_LINE_QUANTITY = 999;

type Resolution = { sku: string } | { reason: RejectReason };

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function fromTarget(target: PointedTarget): Resolution {
  switch (target.state) {
    case "product":
      return { sku: target.sku };
    case "unknown":
      return { reason: "not_in_shop" };
    case "ambiguous":
      return { reason: "unclear_product" };
    case "none":
      return { reason: "nothing_pointed" };
    default:
      return { reason: "check_failed" };
  }
}

// Exact name or alias only; a near miss is not treated as a product.
function fromName(name: string, products: Product[]): Resolution {
  const wanted = normalize(name);
  const matches = products.filter((product) =>
    [product.name, ...product.aliases].some((term) => normalize(term) === wanted),
  );

  if (matches.length === 1) return { sku: matches[0].sku };
  return { reason: matches.length === 0 ? "not_in_shop" : "unclear_product" };
}

// Applies the spoken actions in order to a copy of the basket. Each action is checked on its own:
// a rejected one changes nothing, and later actions still run.
export function applyActions(
  lines: BasketLine[],
  actions: IntentAction[],
  targets: PointedTarget[],
  products: Product[],
): { lines: BasketLine[]; outcomes: Outcome[] } {
  const active = products.filter((product) => product.active);
  const bySku = new Map(active.map((product) => [product.sku, product]));
  const next = lines.map((line) => ({ ...line }));
  const outcomes: Outcome[] = [];

  // Pauses pair with this/that references in spoken order. Any other count means the pairing
  // is unknown, so none of those requests is applied.
  const pointCount = actions.filter((action) => action.reference === "POINT").length;
  const paired = targets.length === pointCount;
  let pointIndex = 0;
  let previous: string | null = null;

  for (const action of actions) {
    const base = { action: action.action, quantity: action.quantity, spoken: action.spoken };
    let pointNumber: number | null = null;
    let resolution: Resolution;

    if (action.reference === "POINT") {
      if (targets.length === 0) resolution = { reason: "nothing_pointed" };
      else if (!paired) resolution = { reason: "count_mismatch" };
      else {
        pointNumber = pointIndex + 1;
        resolution = fromTarget(targets[pointIndex]);
      }
      pointIndex += 1;
    } else if (action.reference === "SAME") {
      resolution = previous ? { sku: previous } : { reason: "no_previous" };
    } else {
      resolution = fromName(action.namedProduct ?? "", active);
    }

    const reject = (reason: RejectReason) => {
      outcomes.push({ ...base, pointNumber, status: "rejected", reason });
    };

        const product: Product | undefined = "sku" in resolution ? bySku.get(resolution.sku) : undefined;
    if (!product) {
      previous = null;
      reject("reason" in resolution ? resolution.reason : "not_in_shop");
      continue;
    }
    previous = product.sku;

    const index = next.findIndex((line) => line.sku === product.sku);
    const current = index >= 0 ? next[index].quantity : 0;
    let quantity: number;

    if (action.action === "REMOVE") {
      if (current === 0) {
        reject("not_in_basket");
        continue;
      }
      if (action.quantity !== null && action.quantity > current) {
        reject("not_enough");
        continue;
      }
      // REMOVE without a number removes the whole line.
      quantity = action.quantity === null ? 0 : current - action.quantity;
    } else {
      if (action.quantity === null) {
        reject("unclear_quantity");
        continue;
      }
      quantity = action.action === "ADD" ? current + action.quantity : action.quantity;
      if (quantity > MAX_LINE_QUANTITY) {
        reject("too_many");
        continue;
      }
    }

    // Name and price always come from the catalogue, never from speech.
    const line: BasketLine = {
      sku: product.sku,
      name: product.name,
      unitPrice: product.price,
      currency: product.currency,
      quantity,
    };
    if (quantity === 0) next.splice(index, 1);
    else if (index >= 0) next[index] = line;
    else next.push(line);

    outcomes.push({ ...base, pointNumber, status: "applied", sku: product.sku, name: product.name, lineQuantity: quantity });
  }

  return { lines: next, outcomes };
}