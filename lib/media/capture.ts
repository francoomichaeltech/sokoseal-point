const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.8;

export type Frame = { url: string; width: number; height: number };

// Grabs the current video frame as a JPEG data URL, downscaled so the long edge is at most MAX_EDGE.
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

  return {
    url: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    width: canvas.width,
    height: canvas.height,
  };
}