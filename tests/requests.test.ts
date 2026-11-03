import { describe, expect, it } from "vitest";
import { clearRequest, getRequest, setRequest, updateRequest } from "../lib/requests/store";

const readyState = (eventId: string) => ({
  eventId,
  phase: "ready" as const,
  heard: "nipe hii moja",
  transcript: "Nipe hii moja.",
  actions: [],
  needsClarification: false,
  targets: [],
  marks: [],
  pointed: 0,
  objectCount: 0,
  handSeen: true,
  evidence: null,
});

describe("request store", () => {
  it("ignores results from an older hold", () => {
    setRequest({ eventId: "b", phase: "processing" });
    updateRequest("a", readyState("a"));
    expect(getRequest()).toEqual({ eventId: "b", phase: "processing" });

    updateRequest("b", readyState("b"));
    expect(getRequest()?.phase).toBe("ready");

    clearRequest();
    expect(getRequest()).toBeNull();
  });
});