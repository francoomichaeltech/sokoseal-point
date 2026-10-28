import { describe, expect, it } from "vitest";
import { encodeWav, isWav, resample } from "../lib/media/wav";

function text(view: DataView, offset: number) {
  return String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(offset + i)));
}

describe("encodeWav", () => {
  const view = new DataView(encodeWav(new Float32Array([0, 1, -1, 2]), 16_000));

  it("writes a 16 kHz mono 16-bit PCM header", () => {
    expect(text(view, 0)).toBe("RIFF");
    expect(text(view, 8)).toBe("WAVE");
    expect(text(view, 36)).toBe("data");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.byteLength).toBe(52);
  });

  it("converts and clamps samples", () => {
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(view.getInt16(50, true)).toBe(32767);
  });
});

describe("resample", () => {
  it("downsamples 48 kHz to 16 kHz by averaging", () => {
    const output = resample(new Float32Array([0.3, 0.6, 0.9, 0, 0, 0]), 48_000);
    expect(output).toHaveLength(2);
    expect(output[0]).toBeCloseTo(0.6);
    expect(output[1]).toBeCloseTo(0);
  });

  it("returns the input when the rate already matches", () => {
    const input = new Float32Array([0.1]);
    expect(resample(input, 16_000)).toBe(input);
  });
});

describe("isWav", () => {
  it("accepts a WAV header", () => {
    expect(isWav(new Uint8Array(encodeWav(new Float32Array(1)).slice(0, 12)))).toBe(true);
  });

  it("rejects other data", () => {
    expect(isWav(new TextEncoder().encode("ID3 not a wav"))).toBe(false);
  });
});