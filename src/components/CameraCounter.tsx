import { useRef, useState, useCallback } from "react";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, RotateCcw, Trophy, Zap, ExternalLink } from "lucide-react";

interface CameraCounterProps {
  onSessionEnd?: (reps: number) => void;
  dailyGoal?: number;
}

export function CameraCounter({ onSessionEnd, dailyGoal = 100 }: CameraCounterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  const { repCount, currentAngle, error, resetCount, isInUpPhase } =
    usePoseDetection(videoRef, canvasRef, cameraOn);

  const goalProgress = Math.min((repCount / dailyGoal) * 100, 100);

  const startSession = useCallback(() => {
    resetCount();
    setSessionActive(true);
    setCameraOn(true);
  }, [resetCount]);

  const endSession = useCallback(() => {
    setSessionActive(false);
    setCameraOn(false);
    onSessionEnd?.(repCount);
  }, [repCount, onSessionEnd]);

  const toggleCamera = useCallback(() => {
    if (!cameraOn) {
      setCameraOn(true);
      setSessionActive(true);
    } else {
      setCameraOn(false);
      setSessionActive(false);
    }
  }, [cameraOn]);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Camera viewport */}
      <div className="relative w-full max-w-md clay-card-lg overflow-hidden">
        <div className="aspect-[4/3] bg-muted relative">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover rounded-[var(--clay-radius)]"
            playsInline
            muted
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover rounded-[var(--clay-radius)]"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* Overlay UI */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Rep counter overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
              <div className="clay-pill bg-background/80 backdrop-blur-sm px-4 py-2 pointer-events-auto">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[var(--primary)]" />
                  <span className="font-bold text-2xl text-foreground">{repCount}</span>
                  <span className="text-xs text-muted-foreground">reps</span>
                </div>
              </div>
              {sessionActive && (
                <div className="clay-pill bg-background/80 backdrop-blur-sm px-3 py-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isInUpPhase ? "bg-green-500" : "bg-red-400"} animate-pulse`} />
                </div>
              )}
            </div>

            {/* Bottom status */}
            <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
              {cameraOn && (
                <div className="clay-inset bg-background/70 backdrop-blur-sm px-4 py-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    {isInUpPhase ? "Hold at the top" : "Lower back down"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Camera off placeholder */}
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <CameraOff className="w-12 h-12 opacity-50" />
              <p className="text-sm">Camera is off</p>
            </div>
          )}
        </div>
      </div>

      {/* Goal progress */}
      <div className="w-full max-w-md clay-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[var(--primary)]" />
            <span className="font-semibold text-foreground">Daily Goal</span>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {repCount}/{dailyGoal}
          </span>
        </div>
        <div className="w-full h-4 clay-inset overflow-hidden">
          <div
            className="h-full rounded-[var(--clay-radius)] transition-all duration-500 ease-out"
            style={{
              width: `${goalProgress}%`,
              background: goalProgress >= 100
                ? "linear-gradient(135deg, #b5e8d5, #5ecfb5)"
                : "linear-gradient(135deg, #f4845f, #f8c8dc)",
            }}
          />
        </div>
        {goalProgress >= 100 && (
          <p className="mt-2 text-sm font-medium text-[var(--accent)]">
            Daily goal reached.
          </p>
        )}
      </div>

      {/* Angle meter */}
      {cameraOn && (
        <div className="w-full max-w-md clay-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Torso Angle</span>
            <span className="text-sm text-muted-foreground">{currentAngle}°</span>
          </div>
          <div className="w-full h-3 clay-inset overflow-hidden">
            <div
              className="h-full rounded-[var(--clay-radius)] transition-all duration-100"
              style={{
                width: `${Math.min(currentAngle, 180) / 1.8}%`,
                background: isInUpPhase
                  ? "linear-gradient(135deg, #b5e8d5, #5ecfb5)"
                  : "linear-gradient(135deg, #f8c8dc, #f4845f)",
              }}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 w-full max-w-md">
        {!sessionActive ? (
          <Button onClick={startSession} className="clay-btn flex-1 h-14 text-lg font-semibold">
            <Camera className="w-5 h-5 mr-2" />
            Start Session
          </Button>
        ) : (
          <>
            <Button onClick={endSession} className="clay-btn flex-1 h-14 text-lg font-semibold">
              End Session
            </Button>
            <Button
              onClick={toggleCamera}
              className="clay-btn h-14 w-14"
              style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
            >
              <CameraOff className="w-5 h-5" />
            </Button>
          </>
        )}
        <Button
          onClick={() => {
            resetCount();
            setSessionActive(false);
          }}
          className="clay-btn h-14 w-14"
          style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
        >
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {error && (
        <div className="clay-card p-4 w-full max-w-md">
          {error === "CAMERA_BLOCKED_IFRAME" ? (
            <div className="text-center">
              <CameraOff className="w-8 h-8 text-[var(--primary)] mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">
                Camera unavailable in preview
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Browser security blocks camera access inside embedded previews.
                Open the app in a full tab to use the camera.
              </p>
              <Button
                onClick={() => window.open(window.location.href, "_blank")}
                className="clay-btn h-10 px-5 text-sm"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          ) : (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
