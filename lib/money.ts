export const CURRENCIES = ["USD", "TZS"] as const;

export type Currency = (typeof CURRENCIES)[number];

// Prices are stored as integers in minor units: cents for USD, whole shillings for TZS.
const MINOR_DIGITS: Record<Currency, number> = { USD: 2, TZS: 0 };
const PREFIX: Record<Currency, string> = { USD: "USD", TZS: "TSh" };

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.includes(value as Currency);
}

export function currencyPrefix(currency: Currency): string {
  return PREFIX[currency];
}

export function formatMoney(amount: number, currency: Currency): string {
  const digits = MINOR_DIGITS[currency];
  const value = (amount / 10 ** digits).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${PREFIX[currency]} ${value}`;
}

// Parses user input into minor units. Returns null for anything that is not a positive price.
export function parsePrice(input: string, currency: Currency): number | null {
  const digits = MINOR_DIGITS[currency];
  const cleaned = input.replace(/,/g, "").trim();
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${digits}})?$`);
  if (!pattern.test(cleaned)) return null;

  // Built from the digit strings to avoid floating point rounding.
  const [whole, fraction = ""] = cleaned.split(".");
  const amount = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function priceToInput(amount: number, currency: Currency): string {
  const digits = MINOR_DIGITS[currency];
  return digits === 0 ? String(amount) : (amount / 10 ** digits).toFixed(digits);
}