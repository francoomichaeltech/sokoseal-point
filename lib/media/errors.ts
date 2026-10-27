export type MediaFailure = "denied" | "unavailable" | "error";

export function mediaErrorStatus(error: unknown): MediaFailure {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "unavailable";
  }
  return "error";
}