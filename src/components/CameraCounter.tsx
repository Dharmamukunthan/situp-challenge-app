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
  Minus,
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

  // Local undo stack — lets user subtract without hook changes
  const [undoStack, setUndoStack] = useState<number[]>([]);
  const [displayCount, setDisplayCount] = useState(0);

  const goalProgress = Math.min((displayCount / dailyGoal) * 100, 100);

  const startSession = useCallback(() => {
    resetCount();
    setSessionActive(true);
    setCameraOn(false);
    setUndoStack([]);
    setDisplayCount(0);
  }, [resetCount]);

  const endSession = useCallback(() => {
    setSessionActive(false);
    setCameraOn(false);
    onSessionEnd?.(displayCount);
  }, [displayCount, onSessionEnd]);

  const handleAddRep = useCallback(() => {
    addManualRep();
    setDisplayCount((c) => c + 1);
    setUndoStack((s) => [...s, 1]);
  }, [addManualRep]);

  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      setUndoStack((s) => s.slice(0, -1));
      setDisplayCount((c) => Math.max(0, c - 1));
    }
  }, [undoStack]);

  // Sync display count with AI reps if camera is on
  const totalCount = cameraOn ? repCount : displayCount;

  const angleColor =
    currentAngle > 140
      ? "text-red-400"
      : currentAngle < 100
        ? "text-green-400"
        : "text-yellow-400";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Camera viewport — compact when on */}
      {cameraOn && (
        <div className="relative w-full max-w-md clay-card-lg overflow-hidden">
          <div className="aspect-video bg-muted relative">
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
            <div className="absolute top-3 left-3">
              <div className="clay-pill bg-background/80 backdrop-blur-sm px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-[var(--primary)]" />
                  <span className="font-bold text-lg text-foreground">
                    {totalCount}
                  </span>
                </div>
              </div>
            </div>

            {modelLoaded && (
              <div className="absolute top-3 right-12">
                <div className="clay-pill bg-background/80 backdrop-blur-sm px-2.5 py-1.5">
                  <span className={`text-xs font-bold ${angleColor}`}>
                    {currentAngle}°
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => setCameraOn(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-background/80 flex items-center justify-center"
            >
              <CameraOff className="w-3.5 h-3.5" />
            </button>

            <div className="absolute bottom-3 left-3 right-3">
              <div className="clay-pill bg-background/70 backdrop-blur-sm px-3 py-1.5 text-center">
                <p className={`text-xs font-bold ${angleColor}`}>
                  {currentAngle > 140
                    ? "Lying — sit up!"
                    : currentAngle < 100
                      ? "Sitting — lie back!"
                      : "Keep going..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BIG COUNTER */}
      <div className="w-full max-w-md clay-card-lg p-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          Reps Completed
        </p>
        <p className="text-6xl font-black text-foreground leading-none">
          {totalCount}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          of {dailyGoal} daily goal
        </p>

        <div className="w-full h-3 clay-inset overflow-hidden mt-4">
          <div
            className="h-full rounded-[var(--clay-radius)] transition-all duration-300"
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
          <p className="mt-2 text-sm font-bold text-green-500">
            🎉 Daily goal reached!
          </p>
        )}
      </div>

      {/* MAIN +1 BUTTON — big, easy to tap mid-workout */}
      {sessionActive && (
        <div className="w-full max-w-md space-y-3">
          <Button
            onClick={handleAddRep}
            className="w-full h-20 text-2xl font-black rounded-2xl shadow-lg active:scale-95 transition-transform"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            <span className="text-3xl mr-3">+</span>
            1 Rep
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={handleUndo}
              className="flex-1 h-14 text-base font-semibold"
              style={{
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
              disabled={undoStack.length === 0}
            >
              <Minus className="w-4 h-4 mr-2" />
              Undo
            </Button>
            <Button
              onClick={() => setCameraOn(!cameraOn)}
              className="h-14 px-5"
              style={{
                background: cameraOn ? "var(--primary)" : "var(--muted)",
                color: cameraOn
                  ? "var(--primary-foreground)"
                  : "var(--muted-foreground)",
              }}
            >
              {cameraOn ? (
                <CameraOff className="w-5 h-5" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Start / End / Reset */}
      {!sessionActive ? (
        <div className="w-full max-w-md space-y-3">
          <Button
            onClick={startSession}
            className="clay-btn w-full h-16 text-xl font-bold"
          >
            <Camera className="w-6 h-6 mr-3" />
            Start Counting
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Tap +1 after each situp. Open camera for AI tracking (optional).
          </p>
        </div>
      ) : (
        <div className="w-full max-w-md flex gap-3">
          <Button
            onClick={() => {
              resetCount();
              setSessionActive(false);
              setCameraOn(false);
              setUndoStack([]);
              setDisplayCount(0);
            }}
            className="clay-btn flex-1 h-12"
            style={{
              background: "var(--muted)",
              color: "var(--muted-foreground)",
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={endSession}
            className="clay-btn flex-1 h-12 text-base font-semibold"
          >
            End Session
          </Button>
        </div>
      )}

      {/* Debug */}
      {cameraOn && debugInfo && (
        <div className="w-full max-w-md clay-card p-2">
          <p className="text-[9px] text-muted-foreground font-mono truncate">
            {debugInfo}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="clay-card p-3 w-full max-w-md">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}
    </div>
  );
}
