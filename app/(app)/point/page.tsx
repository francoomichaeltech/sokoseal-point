import { CameraView } from "@/components/camera/camera-view";
import { HoldToSpeak } from "@/components/camera/hold-to-speak";

export default function PointPage() {
  return (
    <div className="app-stage">
      <div className="mx-auto flex h-full max-w-md flex-col gap-4 p-4">
        <div className="min-h-0 flex-1">
          <CameraView />
        </div>
        <HoldToSpeak />
      </div>
    </div>
  );
}