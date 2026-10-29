const PREFIX_LENGTH = 3;
const FALLBACK = "ITEM";

// A short readable code from the product name: its first letters plus the lowest free number (Mug -> MUG1).
export function suggestSku(name: string, taken: string[]): string {
  const letters = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, PREFIX_LENGTH);
  const prefix = letters || FALLBACK;
  const used = new Set(taken);

  let number = 1;
  while (used.has(`${prefix}${number}`)) number += 1;
  return `${prefix}${number}`;
}