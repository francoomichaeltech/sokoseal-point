import type { Point } from "@/lib/grounding/types";

// One Euro filter (Casiez, Roussel and Vogel, CHI 2012). Smooths heavily when the input
// moves slowly, which removes landmark jitter, and lightly when it moves fast, which keeps lag low.

function smoothingFactor(cutoffHz: number, dtSeconds: number) {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
}

export class OneEuroFilter {
  private value: number | null = null;
  private velocity = 0;
  private lastTimeMs = 0;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly velocityCutoff: number;

  constructor(minCutoff: number, beta: number, velocityCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.velocityCutoff = velocityCutoff;
  }

  filter(input: number, timeMs: number): number {
    if (this.value === null) {
      this.value = input;
      this.lastTimeMs = timeMs;
      return input;
    }

    const dt = Math.max((timeMs - this.lastTimeMs) / 1000, 0.001);
    this.lastTimeMs = timeMs;

    const rawVelocity = (input - this.value) / dt;
    this.velocity += smoothingFactor(this.velocityCutoff, dt) * (rawVelocity - this.velocity);

    const cutoff = this.minCutoff + this.beta * Math.abs(this.velocity);
    this.value += smoothingFactor(cutoff, dt) * (input - this.value);
    return this.value;
  }

  reset() {
    this.value = null;
    this.velocity = 0;
  }
}

export class PointFilter {
  private readonly x: OneEuroFilter;
  private readonly y: OneEuroFilter;

  constructor(minCutoff: number, beta: number) {
    this.x = new OneEuroFilter(minCutoff, beta);
    this.y = new OneEuroFilter(minCutoff, beta);
  }

  filter(point: Point, timeMs: number): Point {
    return { x: this.x.filter(point.x, timeMs), y: this.y.filter(point.y, timeMs) };
  }

  reset() {
    this.x.reset();
    this.y.reset();
  }
}