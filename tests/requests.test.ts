import { describe, expect, it } from "vitest";
import { clearRequest, getRequest, setRequest, updateRequest } from "../lib/requests/store";

describe("request store", () => {
  it("ignores results from an older hold", () => {
    setRequest({ eventId: "b", phase: "processing" });
    updateRequest("a", { eventId: "a", phase: "error" });
    expect(getRequest()).toEqual({ eventId: "b", phase: "processing" });

    updateRequest("b", { eventId: "b", phase: "error" });
    expect(getRequest()?.phase).toBe("error");

    clearRequest();
    expect(getRequest()).toBeNull();
  });
});