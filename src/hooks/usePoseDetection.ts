import { useEffect, useRef, useState, useCallback } from "react";

export function usePoseDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean
) {
  const [repCount, setRepCount] = useState(0);
  const [isInUpPhase, setIsInUpPhase] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const repCountRef = useRef(0);
  const isInUpRef = useRef(false);
  const prevFrameRef = useRef<ImageData | null>(null);
  const motionAccRef = useRef(0);
  const cooldownRef = useRef(0);

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
    motionAccRef.current = 0;
  }, []);

  // Frame differencing motion detection
  // Tracks vertical motion: significant upward motion = sit-up, rest = down
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

        // Split frame into top and bottom halves
        const midY = Math.floor(h / 2);
        let topMotion = 0;
        let bottomMotion = 0;
        let totalMotion = 0;
        const sampleStep = 20;

        for (let y = 0; y < h; y += sampleStep) {
          for (let x = 0; x < w; x += sampleStep) {
            const i = (y * w + x) * 4;
            const diff =
              Math.abs(data[i] - prev[i]) +
              Math.abs(data[i + 1] - prev[i + 1]) +
              Math.abs(data[i + 2] - prev[i + 2]);
            totalMotion += diff;
            if (y < midY) topMotion += diff;
            else bottomMotion += diff;
          }
        }

        const totalPixels = (w / sampleStep) * (h / sampleStep);
        const avgMotion = totalMotion / totalPixels;
        const topAvg = topMotion / (totalPixels / 2);
        const bottomAvg = bottomMotion / (totalPixels / 2);

        // Detect sit-up motion: body moves up → more motion in top half, less in bottom
        // When sitting up: shoulders/head move up (increased top motion)
        // When lying down: body drops (increased bottom motion)
        const verticalBias = topAvg - bottomAvg;

        // Update angle display based on motion magnitude
        setCurrentAngle(Math.min(180, Math.round(avgMotion * 2)));

        if (cooldownRef.current > 0) {
          cooldownRef.current--;
        }

        // Motion threshold detection
        if (avgMotion > 8) {
          motionAccRef.current += avgMotion;

          // Strong upward bias suggests sitting up
          if (verticalBias > 2 && !isInUpRef.current && cooldownRef.current === 0) {
            isInUpRef.current = true;
            setIsInUpPhase(true);
          }
        }

        // When motion settles after a sit-up burst, count the rep
        if (avgMotion < 4 && motionAccRef.current > 100 && isInUpRef.current && cooldownRef.current === 0) {
          repCountRef.current += 1;
          setRepCount(repCountRef.current);
          isInUpRef.current = false;
          setIsInUpPhase(false);
          motionAccRef.current = 0;
          cooldownRef.current = 15; // ~0.25s cooldown at 60fps
        }

        // Decay accumulator if motion stays low
        if (avgMotion < 4) {
          motionAccRef.current *= 0.95;
        }
      }

      prevFrameRef.current = imageData;
    } catch {
      // Canvas may be tainted in some environments
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
    motionAccRef.current = 0;
    prevFrameRef.current = null;
  }, []);

  return {
    repCount,
    currentAngle,
    modelLoaded,
    error,
    resetCount,
    isInUpPhase,
  };
}
