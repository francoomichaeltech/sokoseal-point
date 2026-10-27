// Copies the MediaPipe wasm runtime into public/ so the app serves it from its own origin.
// Runs on every install, including on Vercel. The output is git-ignored.

import { cp, rm } from "node:fs/promises";

const source = "node_modules/@mediapipe/tasks-vision/wasm";
const target = "public/mediapipe";

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });