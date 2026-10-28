// API routes spend model credits, so only pages served from this host may call them.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}