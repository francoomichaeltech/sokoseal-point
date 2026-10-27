import { CameraView } from "@/components/camera/camera-view";
import { HoldToSpeak } from "@/components/camera/hold-to-speak";

export default function PointPage() {
  return (
    <div className="flex flex-col gap-6">
      <CameraView />
      <HoldToSpeak />
    </div>
  );
}