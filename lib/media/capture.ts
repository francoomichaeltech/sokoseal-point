const MAX_EDGE = 1440;
const JPEG_QUALITY = 0.82;
const SAMPLE_EDGE = 96;

export type Frame = { url: string; width: number; height: number; score?: number };

export type FrameQuality = { sharpness: number; exposure: number; score: number };

/**
 * Scores a frame's sharpness (mean horizontal + vertical luma gradient) and exposure balance
 * (penalising dark, shadowed or clipped frames so well-exposed sharp frames win).
 */
export function scoreFrameQuality(
  pixels: Uint8ClampedArray | number[],
  width: number,
  height: number,
): FrameQuality {
  if (width < 2 || height < 2 || pixels.length < width * height * 4) {
    return { sharpness: 0, exposure: 0, score: 0 };
  }

  const luma = new Float32Array(width * height);
  let sumLuma = 0;
  const count = width * height;

  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    const y = 0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2];
    luma[i] = y;
    sumLuma += y;
  }

  const meanLuma = sumLuma / count;
  let varianceSum = 0;
  for (let i = 0; i < count; i++) {
    const diff = luma[i] - meanLuma;
    varianceSum += diff * diff;
  }
  const stdLuma = Math.sqrt(varianceSum / count);

  let gradientSum = 0;
  let gradientPairs = 0;
  for (let y = 0; y < height - 1; y++) {
    const row = y * width;
    for (let x = 0; x < width - 1; x++) {
      const idx = row + x;
      const gx = Math.abs(luma[idx + 1] - luma[idx]);
      const gy = Math.abs(luma[idx + width] - luma[idx]);
      gradientSum += gx + gy;
      gradientPairs += 2;
    }
  }

  const sharpness = gradientPairs > 0 ? gradientSum / gradientPairs : 0;

  // Ideal mean brightness is 85..185; dark (< 45) or over-exposed (> 225) frames are penalised.
  let brightnessFactor = 1;
  if (meanLuma < 85) {
    brightnessFactor = Math.max(0.15, meanLuma / 85);
  } else if (meanLuma > 185) {
    brightnessFactor = Math.max(0.2, (255 - meanLuma) / 70);
  }

  // Shadowed/flat frames with very low contrast (< 20 stdLuma) are down-weighted.
  const contrastFactor = Math.min(1, Math.max(0.2, stdLuma / 32));
  const exposure = Number((brightnessFactor * contrastFactor).toFixed(4));
  const score = Number((sharpness * exposure).toFixed(4));

  return { sharpness: Number(sharpness.toFixed(4)), exposure, score };
}

/** Picks the sharpest, best-exposed frame from a list of candidates. */
export function pickBestFrame<T extends Frame>(frames: T[]): T | null {
  if (frames.length === 0) return null;
  let best = frames[0];
  let bestScore = best.score ?? 0;

  for (let i = 1; i < frames.length; i++) {
    const candidateScore = frames[i].score ?? 0;
    if (candidateScore >= bestScore) {
      best = frames[i];
      bestScore = candidateScore;
    }
  }
  return best;
}

// Grabs the current video frame as a JPEG data URL, downscaled so the long edge is at most MAX_EDGE,
// and attaches a sharpness + exposure quality score.
export function captureFrame(video: HTMLVideoElement): Frame | null {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;

  const scale = Math.min(1, MAX_EDGE / Math.max(videoWidth, videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(videoWidth * scale);
  canvas.height = Math.round(videoHeight * scale);

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  let score = 0;
  try {
    const sampleScale = Math.min(1, SAMPLE_EDGE / Math.max(canvas.width, canvas.height));
    const sw = Math.max(2, Math.round(canvas.width * sampleScale));
    const sh = Math.max(2, Math.round(canvas.height * sampleScale));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sw;
    sampleCanvas.height = sh;
    const sampleCtx = sampleCanvas.getContext("2d");
    if (sampleCtx) {
      sampleCtx.drawImage(canvas, 0, 0, sw, sh);
      const imageData = sampleCtx.getImageData(0, 0, sw, sh);
      score = scoreFrameQuality(imageData.data, sw, sh).score;
    }
  } catch {
    score = 0;
  }

  return {
    url: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    width: canvas.width,
    height: canvas.height,
    score,
  };
}

/** Captures the current video frame and picks the sharpest, best-exposed frame among it and recent frames. */
export function captureSharpestFrame(video: HTMLVideoElement | null, recentFrames: Frame[] = []): Frame | null {
  const candidates = [...recentFrames];
  if (video) {
    const current = captureFrame(video);
    if (current) candidates.push(current);
  }
  return pickBestFrame(candidates);
}
