import { useRef, useState, useCallback } from "react";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { Button } from "@/components/ui/button";
import {
  Camera,
  CameraOff,
  RotateCcw,
  Trophy,
  Zap,
  Hand,
  Smartphone,
  Info,
} from "lucide-react";

interface CameraCounterProps {
  onSessionEnd?: (reps: number) => void;
  dailyGoal?: number;
}

export function CameraCounter({
  onSessionEnd,
  dailyGoal = 100,
}: CameraCounterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const {
    repCount,
    currentAngle,
    error,
    resetCount,
    isInUpPhase,
    modelLoaded,
    addManualRep,
    debugInfo,
  } = usePoseDetection(videoRef, canvasRef, cameraOn);

  const goalProgress = Math.min((repCount / dailyGoal) * 100, 100);

  const startSession = useCallback(() => {
    resetCount();
    setSessionActive(true);
    setCameraOn(true);
    setShowGuide(true);
    setTimeout(() => setShowGuide(false), 10000);
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

  const angleColor =
    currentAngle > 140
      ? "text-red-400"
      : currentAngle < 100
        ? "text-green-400"
        : "text-yellow-400";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Position guide — before session */}
      {!sessionActive && showGuide && (
        <div className="w-full max-w-md clay-card p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary rotate-90" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                📱 Phone Placement (IMPORTANT)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Place your phone <strong>on the floor to your side</strong> so
                the back camera sees your full body profile. Lie down in front of
                it. Front-facing view will NOT count reps.
              </p>
              <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                <p>✅ Phone on floor, to your side</p>
                <p>✅ Back camera facing you</p>
                <p>✅ Full body visible in frame</p>
                <p>❌ Don't hold phone in hand</p>
                <p>❌ Don't face camera directly</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera viewport */}
      <div className="relative w-full max-w-md clay-card-lg overflow-hidden">
        <div className="aspect-[4/3] bg-muted relative">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover rounded-[var(--clay-radius)]"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover rounded-[var(--clay-radius)]"
          />

          {/* Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Rep counter */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
              <div className="clay-pill bg-background/80 backdrop-blur-sm px-4 py-2 pointer-events-auto">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[var(--primary)]" />
                  <span className="font-bold text-2xl text-foreground">
                    {repCount}
                  </span>
                  <span className="text-xs text-muted-foreground">reps</span>
                </div>
              </div>
              {sessionActive && modelLoaded && (
                <div className="clay-pill bg-background/80 backdrop-blur-sm px-3 py-2">
                  <span className={`text-xs font-bold ${angleColor}`}>
                    {currentAngle}°
                  </span>
                </div>
              )}
            </div>

            {/* Positioning overlay */}
            {sessionActive && showGuide && modelLoaded && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                <div
                  className="clay-card-lg p-5 text-center max-w-xs cursor-pointer"
                  onClick={() => setShowGuide(false)}
                >
                  <Smartphone className="w-8 h-8 text-primary mx-auto mb-2 rotate-90" />
                  <p className="text-base font-bold text-foreground">
                    Place Phone to Your Side
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Back camera should see your full body from the side. Lie
                    down, then sit up.
                  </p>
                  <p className="text-[10px] text-primary mt-2">Tap to dismiss</p>
                </div>
              </div>
            )}

            {/* Status bar */}
            <div className="absolute bottom-4 left-4 right-4">
              {cameraOn && !showGuide && (
                <div className="clay-inset bg-background/70 backdrop-blur-sm px-4 py-2 text-center">
                  <p className={`text-sm font-bold ${angleColor}`}>
                    {currentAngle > 140
                      ? "LYING — Sit up now!"
                      : currentAngle < 100
                        ? "SITTING — Lie back down!"
                        : "Keep going..."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Camera off */}
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <CameraOff className="w-12 h-12 opacity-50" />
              <p className="text-sm">Camera is off</p>
            </div>
          )}
        </div>
      </div>

      {/* Debug info (shown when camera is on) */}
      {cameraOn && debugInfo && (
        <div className="w-full max-w-md clay-card p-3">
          <div className="flex items-center gap-2">
            <Info className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {debugInfo}
            </p>
          </div>
        </div>
      )}

      {/* Model loading */}
      {cameraOn && !modelLoaded && (
        <div className="w-full max-w-md clay-card p-3">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">
              Loading AI model...
            </p>
          </div>
        </div>
      )}

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
              background:
                goalProgress >= 100
                  ? "linear-gradient(135deg, #b5e8d5, #5ecfb5)"
                  : "linear-gradient(135deg, #f4845f, #f8c8dc)",
            }}
          />
        </div>
        {goalProgress >= 100 && (
          <p className="mt-2 text-sm font-medium text-[var(--accent)]">
            Daily goal reached!
          </p>
        )}
      </div>

      {/* Angle meter */}
      {cameraOn && modelLoaded && (
        <div className="w-full max-w-md clay-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              Shoulder-Hip-Knee Angle
            </span>
            <span className={`text-sm font-bold ${angleColor}`}>
              {currentAngle}°
            </span>
          </div>
          <div className="w-full h-3 clay-inset overflow-hidden">
            <div
              className="h-full rounded-[var(--clay-radius)] transition-all duration-100"
              style={{
                width: `${Math.min((currentAngle / 180) * 100, 100)}%`,
                background:
                  currentAngle > 140
                    ? "linear-gradient(135deg, #f8c8dc, #f4845f)"
                    : currentAngle < 100
                      ? "linear-gradient(135deg, #b5e8d5, #5ecfb5)"
                      : "linear-gradient(135deg, #fbbf24, #f59e0b)",
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-green-500">
              Sitting ({'<'}100°)
            </span>
            <span className="text-[10px] text-red-400">
              Lying ({'>'}140°)
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 w-full max-w-md">
        {!sessionActive ? (
          <Button
            onClick={startSession}
            className="clay-btn flex-1 h-14 text-lg font-semibold"
          >
            <Camera className="w-5 h-5 mr-2" />
            Start Session
          </Button>
        ) : (
          <>
            <Button
              onClick={endSession}
              className="clay-btn flex-1 h-14 text-lg font-semibold"
            >
              End Session
            </Button>
            <Button
              onClick={toggleCamera}
              className="clay-btn h-14 w-14"
              style={{
                background: "var(--secondary)",
                color: "var(--secondary-foreground)",
              }}
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
          style={{
            background: "var(--muted)",
            color: "var(--muted-foreground)",
          }}
        >
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* Manual rep button — always visible during session */}
      {sessionActive && (
        <div className="w-full max-w-md">
          <Button
            onClick={addManualRep}
            className="clay-btn w-full h-14 text-lg font-bold"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            <Hand className="w-5 h-5 mr-2" />
            +1 Rep
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Tap every time you complete a situp
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="clay-card p-4 w-full max-w-md">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}
