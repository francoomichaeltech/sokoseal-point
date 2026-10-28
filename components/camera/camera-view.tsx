"use client";

import { Camera, LoaderCircle, TriangleAlert } from "lucide-react";
import type { Box, Selection } from "@/lib/grounding/types";
import type { TargetIdentity } from "@/lib/identity/types";
import { useMessages } from "@/lib/i18n/locale";
import type { Messages } from "@/lib/i18n/messages";
import type { useCamera } from "@/lib/media/use-camera";
import type { TrackerStatus } from "@/lib/pointing/use-pointing-session";
import { boxToView } from "@/lib/pointing/viewport";
import { useElementSize } from "@/lib/use-element-size";

export type Pointed = {
  frame: { width: number; height: number };
  /** One entry per finger pause, in the order they happened. */
  selections: Selection[];
  /** Identity of the object behind each MATCH selection; null for other selections. */
  labels: (TargetIdentity | null)[];
  /** Objects SAM found on the counter. */
  objectCount: number;
  scanFailed: boolean;
};

type CameraViewProps = {
  camera: ReturnType<typeof useCamera>;
  tracker: TrackerStatus;
  pointed: Pointed | null;
};

type Chip = { text: string; tone: "neutral" | "busy" | "attention" };

type Outline = { box: Box; numbers: number[]; label: TargetIdentity | null; ambiguous: boolean };

// After a hold, says what pointing captured so a missing outline has a visible reason.
function statusChip(tracker: TrackerStatus, pointed: Pointed | null, t: Messages["point"]): Chip {
  if (tracker === "error") return { text: t.pointing.unsupported, tone: "attention" };
  if (tracker === "loading") return { text: t.pointing.loading, tone: "busy" };
  if (!pointed) return { text: t.hint, tone: "neutral" };
  if (pointed.scanFailed) return { text: t.ground.error, tone: "attention" };
  if (pointed.selections.length === 0) return { text: t.pointing.noDwell, tone: "attention" };
  if (pointed.objectCount === 0) return { text: t.pointing.noObjects, tone: "attention" };
  return { text: t.pointing.summary(pointed.selections.length, pointed.objectCount), tone: "neutral" };
}

// One outline per object, listing every pause that pointed at it.
function outlines(pointed: Pointed): Outline[] {
  const byBox = new Map<Box, Outline>();

  pointed.selections.forEach((selection, index) => {
    const boxes =
      selection.status === "MATCH" ? [selection.box] : selection.status === "AMBIGUOUS" ? selection.boxes : [];

    for (const box of boxes) {
      const existing = byBox.get(box);
      if (existing) {
        existing.numbers.push(index + 1);
        continue;
      }
      byBox.set(box, {
        box,
        numbers: [index + 1],
        label: selection.status === "MATCH" ? (pointed.labels[index] ?? null) : null,
        ambiguous: selection.status === "AMBIGUOUS",
      });
    }
  });

  return [...byBox.values()];
}

function labelText(label: TargetIdentity, t: Messages["point"]): string {
  switch (label.state) {
    case "pending":
      return t.identity.checking;
    case "product":
      return label.name;
    case "unknown":
      return t.identity.unknown;
    case "ambiguous":
      return t.identity.ambiguous;
    default:
      return t.identity.error;
  }
}

export function CameraView({ camera, tracker, pointed }: CameraViewProps) {
  const { videoRef, status, start } = camera;
  const [viewRef, view] = useElementSize<HTMLDivElement>();
  const t = useMessages().point;
  const live = status === "live";
  const chip = statusChip(tracker, pointed, t);

  return (
    <div ref={viewRef} className="viewfinder h-full rounded-card">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

      {live && pointed && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {outlines(pointed).map((outline, index) => {
            const verified =
              !outline.ambiguous &&
              (outline.label === null || outline.label.state === "pending" || outline.label.state === "product");

            return (
              <div
                key={index}
                className={`absolute rounded-lg ${
                  verified
                    ? "border-[3px] border-primary shadow-[0_0_0_1px_rgb(255_255_255/0.8)]"
                    : "border-2 border-dashed border-attention"
                }`}
                style={boxToView(outline.box, view, pointed.frame)}
              >
                <span
                  className={`absolute -top-3 -left-3 flex h-6 max-w-44 min-w-6 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap text-white ${
                    verified ? "bg-primary" : "bg-attention"
                  }`}
                >
                  {outline.numbers.join(", ")}
                  {outline.label && <span className="truncate font-medium">· {labelText(outline.label, t)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {live ? (
        <p
          role="status"
          className={`pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-fit max-w-[90%] items-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm text-white ${
            chip.tone === "attention" ? "bg-attention" : "bg-ink/70"
          }`}
        >
          {chip.tone === "busy" && <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin" />}
          {chip.tone === "attention" && <TriangleAlert aria-hidden size={16} className="shrink-0" />}
          {chip.text}
        </p>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink p-6 text-center text-white">
          {status === "checking" || status === "starting" ? (
            <LoaderCircle aria-hidden size={28} className="animate-spin" />
          ) : (
            <Camera aria-hidden size={32} strokeWidth={1.5} />
          )}

          <p role="status" className="max-w-64 text-sm">
            {status === "checking" ? t.camera.starting : t.camera[status]}
          </p>

          {status !== "checking" && status !== "starting" && status !== "unavailable" && (
            <button
              type="button"
              onClick={start}
              className="tap-target rounded-card bg-primary px-5 font-semibold text-white"
            >
              {status === "idle" ? t.camera.start : t.camera.retry}
            </button>
          )}
        </div>
      )}
    </div>
  );
}