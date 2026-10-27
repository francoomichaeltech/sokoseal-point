import type { HandLandmarker } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let pending: Promise<HandLandmarker> | null = null;

async function create(): Promise<HandLandmarker> {
  const vision = await import("@mediapipe/tasks-vision");
  // Wasm runtime copied to public/mediapipe by scripts/copy-mediapipe.mjs.
  const fileset = await vision.FilesetResolver.forVisionTasks(
    new URL("/mediapipe", window.location.origin).href,
  );

  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO" as const,
    numHands: 1,
  });

  try {
    return await vision.HandLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    // Some phones have no usable WebGL context for the GPU delegate.
    return vision.HandLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

// Shared instance: the model is several megabytes and slow to initialise.
export function loadHandLandmarker(): Promise<HandLandmarker> {
  pending ??= create().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}