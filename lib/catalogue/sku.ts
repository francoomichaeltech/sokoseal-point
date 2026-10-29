// Identity uses these words for "no match"; generated SKUs always end in a digit, so they never collide.
const RESERVED = new Set(["unknown", "ambiguous"]);

export function isReservedSku(sku: string): boolean {
  return RESERVED.has(sku.toLowerCase());
}

/** First three letters of the name plus the lowest free number, unique in the shop ignoring case (Pepsi -> PEP1). */
export function generateSku(name: string, taken: string[]): string {
  const prefix =
    name
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 3) || "ITEM";
  const used = new Set(taken.map((sku) => sku.toUpperCase()));

  let number = 1;
  while (used.has(`${prefix}${number}`)) number += 1;
  return `${prefix}${number}`;
}