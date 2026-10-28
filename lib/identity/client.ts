import type { IdentityResult, ReferenceProduct } from "./types";

export async function requestIdentity(targets: string[], products: ReferenceProduct[]): Promise<IdentityResult> {
  try {
    const response = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets, products }),
    });
    return response.ok ? await response.json() : { status: "ERROR", latencyMs: 0 };
  } catch {
    return { status: "ERROR", latencyMs: 0 };
  }
}