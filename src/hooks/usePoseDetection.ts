import { useEffect, useRef, useState, useCallback } from "react";

export function usePoseDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean
) {
  const [repCount, setRepCount] = useState(0);
  const [isInUpPhase, setIsInUpPhase] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const repCountRef = useRef(0);
  const isInUpRef = useRef(false);
  const prevFrameRef = useRef<ImageData | null>(null);
  const cooldownRef = useRef(0);

  // Directional tracking state
  const upMotionAccRef = useRef(0);   // accumulated upward motion
  const downMotionAccRef = useRef(0); // accumulated downward motion
  const phaseFramesRef = useRef(0);   // frames in current phase

  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  const startCamera = useCallback(async () => {
    if (isInIframe) {
      setError("CAMERA_BLOCKED_IFRAME");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setError(null);
    } catch (err) {
      const name = (err as Error).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Camera permission was denied. Enable it in your browser settings and reload.");
      } else if (name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Camera access denied. Please allow camera permissions.");
      }
    }
  }, [videoRef, isInIframe]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    prevFrameRef.current = null;
  }, []);

  // Improved directional motion detection
  // Tracks WHERE motion happens (top vs bottom of frame) to detect
  // the directional pattern of a situp: body moves UP then DOWN
  const detectMotion = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;
      const h = canvas.height;

      if (prevFrameRef.current) {
        const prev = prevFrameRef.current.data;

        const midY = Math.floor(h / 2);
        const sampleStep = 16;

        // Count moving pixels in each half and track their vertical center
        let topMotionPixels = 0;
        let bottomMotionPixels = 0;
        let topWeightedY = 0;
        let bottomWeightedY = 0;
        let totalMotion = 0;
        let motionPixelCount = 0;

        for (let y = 0; y < h; y += sampleStep) {
          for (let x = 0; x < w; x += sampleStep) {
            const i = (y * w + x) * 4;
            const diff =
              Math.abs(data[i] - prev[i]) +
              Math.abs(data[i + 1] - prev[i + 1]) +
              Math.abs(data[i + 2] - prev[i + 2]);

            // Only consider pixels with meaningful motion (threshold per-pixel)
            if (diff > 40) {
              totalMotion += diff;
              motionPixelCount++;

              if (y < midY) {
                topMotionPixels++;
                topWeightedY += y;
              } else {
                bottomMotionPixels++;
                bottomWeightedY += y;
              }
            }
          }
        }

        const totalSampledPixels = (w / sampleStep) * (h / sampleStep);
        const motionRatio = motionPixelCount / totalSampledPixels;

        // Calculate where the center of motion is (0 = top, 1 = bottom)
        const motionCenter =
          motionPixelCount > 0
            ? (topWeightedY + bottomWeightedY) / (motionPixelCount * h)
            : 0.5;

        // Show motion intensity as the "angle" display
        setCurrentAngle(Math.min(100, Math.round(motionRatio * 300)));

        if (cooldownRef.current > 0) {
          cooldownRef.current--;
        }

        // Directional detection:
        // When user sits up: body moves upward → motion center shifts UP (lower value)
        // When user lies down: body moves downward → motion center shifts DOWN (higher value)
        //
        // We detect situp as a TWO-PHASE motion:
        //   Phase 1: Motion center is in upper half (motionCenter < 0.45) = "sitting up"
        //   Phase 2: Motion center drops to lower half (motionCenter > 0.55) = "lying down"
        // When BOTH phases complete with enough motion → count 1 rep

        const UP_THRESHOLD = 0.42;   // motion center above this = body moving up
        const DOWN_THRESHOLD = 0.58; // motion center below this = body moving down
        const MIN_MOTION_RATIO = 0.03; // at least 3% of pixels must be moving
        const MIN_FRAMES_PER_PHASE = 3; // minimum frames to validate a phase

        if (motionRatio > MIN_MOTION_RATIO) {
          phaseFramesRef.current++;

          if (!isInUpRef.current) {
            // Looking for UP phase
            if (motionCenter < UP_THRESHOLD && phaseFramesRef.current >= MIN_FRAMES_PER_PHASE) {
              isInUpRef.current = true;
              setIsInUpPhase(true);
              upMotionAccRef.current = motionRatio;
              phaseFramesRef.current = 0;
            }
          } else {
            // In UP phase, now looking for DOWN phase
            upMotionAccRef.current += motionRatio;

            if (motionCenter > DOWN_THRESHOLD && phaseFramesRef.current >= MIN_FRAMES_PER_PHASE) {
              // Both phases detected! Count the rep
              downMotionAccRef.current = motionRatio;

              if (cooldownRef.current === 0) {
                repCountRef.current += 1;
                setRepCount(repCountRef.current);
                cooldownRef.current = 20; // ~0.3s cooldown
              }

              // Reset for next rep
              isInUpRef.current = false;
              setIsInUpPhase(false);
              upMotionAccRef.current = 0;
              downMotionAccRef.current = 0;
              phaseFramesRef.current = 0;
            }
          }
        } else {
          // No significant motion — decay phase counters
          phaseFramesRef.current = Math.max(0, phaseFramesRef.current - 1);

          // If we were in up phase but motion stopped for too long, reset
          // (user might have just moved their arm, not a real situp)
          if (isInUpRef.current && phaseFramesRef.current === 0 && upMotionAccRef.current < 0.5) {
            isInUpRef.current = false;
            setIsInUpPhase(false);
            upMotionAccRef.current = 0;
            phaseFramesRef.current = 0;
          }
        }
      }

      prevFrameRef.current = imageData;
    } catch {
      // Canvas tainted or unavailable
    }
  }, [videoRef, canvasRef]);

  useEffect(() => {
    if (!enabled) {
      stopCamera();
      return;
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      detectMotion();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    startCamera().then(() => {
      if (running) loop();
    });

    return () => {
      running = false;
      stopCamera();
    };
  }, [enabled, startCamera, stopCamera, detectMotion]);

  const resetCount = useCallback(() => {
    repCountRef.current = 0;
    setRepCount(0);
    isInUpRef.current = false;
    setIsInUpPhase(false);
    upMotionAccRef.current = 0;
    downMotionAccRef.current = 0;
    phaseFramesRef.current = 0;
    prevFrameRef.current = null;
  }, []);

  return {
    repCount,
    currentAngle,
    error,
    resetCount,
    isInUpPhase,
  };
}
