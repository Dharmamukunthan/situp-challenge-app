import { useEffect, useRef, useState, useCallback } from "react";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

/**
 * Situp counter using TensorFlow.js MoveNet pose detection.
 *
 * FRONT CAMERA geometry (user facing the camera):
 * - Lying down: shoulders are close to hips in screen Y (body foreshortened)
 * - Sitting up: shoulders are far above hips in screen Y (body extended vertically)
 *
 * We track the shoulder-hip vertical DISTANCE as % of frame height.
 * A calibration step sets the personal lying/sitting baselines.
 */

const SMOOTH_WINDOW = 6;
const POSE_SCORE_THRESHOLD = 0.25;

// Default thresholds (calibration overrides these)
const DEFAULT_LYING_RATIO = 0.15; // shoulder-hip distance when lying < 15% of frame height
const DEFAULT_SITTING_RATIO = 0.30; // shoulder-hip distance when sitting > 30% of frame height

interface CalibrationData {
  lyingRatio: number;
  sittingRatio: number;
  done: boolean;
}

export function usePoseDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean
) {
  const [repCount, setRepCount] = useState(0);
  const [isInUpPhase, setIsInUpPhase] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationData>({
    lyingRatio: DEFAULT_LYING_RATIO,
    sittingRatio: DEFAULT_SITTING_RATIO,
    done: false,
  });
  const [calibrationPhase, setCalibrationPhase] = useState<
    "none" | "lying" | "sitting"
  >("none");

  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const repCountRef = useRef(0);
  const cooldownRef = useRef(0);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const isInUpRef = useRef(false);
  const angleHistoryRef = useRef<number[]>([]);
  const lyingSamplesRef = useRef<number[]>([]);
  const sittingSamplesRef = useRef<number[]>([]);
  const calibrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store calibration in a ref so the detection loop always reads the latest
  const calibrationRef = useRef(calibration);
  calibrationRef.current = calibration;

  const startCamera = useCallback(async () => {
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
        setError(
          "Camera permission denied. Allow camera in browser settings and reload."
        );
      } else if (name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not access camera: " + (err as Error).message);
      }
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (detectorRef.current) {
      detectorRef.current.dispose();
      detectorRef.current = null;
    }
    angleHistoryRef.current = [];
    setModelLoaded(false);
  }, []);

  const initDetector = useCallback(async () => {
    try {
      const tf = await import("@tensorflow/tfjs-core");
      await tf.setBackend("webgl");
      await tf.ready();

      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        }
      );
      detectorRef.current = detector;
      setModelLoaded(true);
      return detector;
    } catch (err) {
      console.error("Failed to init pose detector:", err);
      setError("Failed to load AI model. Check your internet connection.");
      return null;
    }
  }, []);

  // Get shoulder-hip vertical distance ratio
  const getShoulderHipRatio = useCallback(
    (
      keypoints: poseDetection.Keypoint[],
      frameHeight: number
    ): number | null => {
      const ls = keypoints.find((k) => k.name === "left_shoulder");
      const rs = keypoints.find((k) => k.name === "right_shoulder");
      const lh = keypoints.find((k) => k.name === "left_hip");
      const rh = keypoints.find((k) => k.name === "right_hip");

      if (
        !ls || !rs || !lh || !rh ||
        (ls.score ?? 0) < POSE_SCORE_THRESHOLD ||
        (rs.score ?? 0) < POSE_SCORE_THRESHOLD ||
        (lh.score ?? 0) < POSE_SCORE_THRESHOLD ||
        (rh.score ?? 0) < POSE_SCORE_THRESHOLD
      ) {
        return null;
      }

      const shoulderY = (ls.y + rs.y) / 2;
      const hipY = (lh.y + rh.y) / 2;
      const distance = Math.abs(shoulderY - hipY);
      return distance / frameHeight; // ratio 0..1
    },
    []
  );

  // Core detection loop — reads from video, runs model, counts reps
  const detectPose = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !detectorRef.current)
      return;

    try {
      const poses = await detectorRef.current.estimatePoses(video);
      if (poses.length === 0) return;

      const keypoints = poses[0].keypoints;
      const frameHeight = video.videoHeight;
      const frameWidth = video.videoWidth;

      const ratio = getShoulderHipRatio(keypoints, frameHeight);
      if (ratio === null) return;

      // Smooth the ratio
      const history = angleHistoryRef.current;
      history.push(ratio);
      if (history.length > SMOOTH_WINDOW) history.shift();
      const smoothed =
        history.reduce((a, b) => a + b, 0) / history.length;

      // Display as angle-like value for the UI (0-100 scale)
      setCurrentAngle(Math.round(smoothed * 200));

      // Calibration data collection
      if (calibrationPhase === "lying") {
        lyingSamplesRef.current.push(smoothed);
        if (lyingSamplesRef.current.length >= 30) {
          const avg =
            lyingSamplesRef.current.reduce((a, b) => a + b, 0) /
            lyingSamplesRef.current.length;
          setCalibration((prev) => ({ ...prev, lyingRatio: avg }));
          setCalibrationPhase("none");
          lyingSamplesRef.current = [];
        }
        return; // Don't count reps during calibration
      }
      if (calibrationPhase === "sitting") {
        sittingSamplesRef.current.push(smoothed);
        if (sittingSamplesRef.current.length >= 30) {
          const avg =
            sittingSamplesRef.current.reduce((a, b) => a + b, 0) /
            sittingSamplesRef.current.length;
          setCalibration((prev) => ({
            ...prev,
            sittingRatio: avg,
            done: true,
          }));
          setCalibrationPhase("none");
          sittingSamplesRef.current = [];
        }
        return; // Don't count reps during calibration
      }

      // Draw skeleton on canvas
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        ctx.clearRect(0, 0, frameWidth, frameHeight);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-frameWidth, 0);

        // Draw body connections
        const connections: [string, string][] = [
          ["left_shoulder", "right_shoulder"],
          ["left_shoulder", "left_hip"],
          ["right_shoulder", "right_hip"],
          ["left_hip", "right_hip"],
          ["left_shoulder", "left_elbow"],
          ["right_shoulder", "right_elbow"],
          ["left_elbow", "left_wrist"],
          ["right_elbow", "right_wrist"],
        ];

        const kpMap = new Map(keypoints.map((k) => [k.name, k]));

        for (const [a, b] of connections) {
          const ka = kpMap.get(a);
          const kb = kpMap.get(b);
          if (
            ka && kb &&
            (ka.score ?? 0) > POSE_SCORE_THRESHOLD &&
            (kb.score ?? 0) > POSE_SCORE_THRESHOLD
          ) {
            ctx.beginPath();
            ctx.moveTo(ka.x, ka.y);
            ctx.lineTo(kb.x, kb.y);
            ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        // Draw keypoints
        for (const kp of keypoints) {
          if ((kp.score ?? 0) > POSE_SCORE_THRESHOLD) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle =
              kp.name?.includes("shoulder") || kp.name?.includes("hip")
                ? "#22c55e"
                : "#3b82f6";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Draw ratio label
        ctx.font = "bold 18px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        const label = `Ratio: ${(smoothed * 100).toFixed(0)}%`;
        ctx.strokeText(label, 15, 30);
        ctx.fillText(label, 15, 30);

        const cal = calibrationRef.current;
        ctx.font = "14px sans-serif";
        ctx.fillText(
          `Lying: <${(cal.lyingRatio * 100).toFixed(0)}%  Sitting: >${(cal.sittingRatio * 100).toFixed(0)}%`,
          15,
          55
        );

        ctx.restore();
      }

      // Rep counting using calibrated thresholds
      const cal = calibrationRef.current;
      const lyingThreshold = cal.done
        ? (cal.lyingRatio + cal.sittingRatio) / 2
        : DEFAULT_LYING_RATIO + (DEFAULT_SITTING_RATIO - DEFAULT_LYING_RATIO) / 2;
      const lowThreshold = cal.done ? cal.lyingRatio : DEFAULT_LYING_RATIO;
      const highThreshold = cal.done ? cal.sittingRatio : DEFAULT_SITTING_RATIO;

      if (cooldownRef.current > 0) {
        cooldownRef.current--;
      }

      if (!isInUpRef.current) {
        // Lying down — waiting for user to sit up
        // Ratio increases as user sits up (shoulders move away from hips in screen Y)
        if (smoothed > highThreshold) {
          isInUpRef.current = true;
          setIsInUpPhase(true);
        }
      } else {
        // Sitting up — waiting for user to lie back down
        if (smoothed < lowThreshold) {
          // Full situp completed!
          if (cooldownRef.current === 0) {
            repCountRef.current += 1;
            setRepCount(repCountRef.current);
            cooldownRef.current = 45; // ~0.75s cooldown
          }
          isInUpRef.current = false;
          setIsInUpPhase(false);
        }
      }
    } catch {
      // Skip frame on error
    }
  }, [videoRef, canvasRef, getShoulderHipRatio, calibrationPhase]);

  // Animation loop
  useEffect(() => {
    if (!enabled) {
      stopCamera();
      return;
    }

    let running = true;

    const loop = () => {
      if (!running) return;
      detectPose().then(() => {
        if (running) {
          animFrameRef.current = requestAnimationFrame(loop);
        }
      });
    };

    const init = async () => {
      await startCamera();
      if (!detectorRef.current) {
        await initDetector();
      }
      if (running) loop();
    };

    init();

    return () => {
      running = false;
      if (calibrationTimerRef.current) {
        clearTimeout(calibrationTimerRef.current);
      }
      stopCamera();
    };
  }, [enabled, startCamera, stopCamera, detectPose, initDetector]);

  const resetCount = useCallback(() => {
    repCountRef.current = 0;
    setRepCount(0);
    isInUpRef.current = false;
    setIsInUpPhase(false);
    cooldownRef.current = 0;
    angleHistoryRef.current = [];
  }, []);

  // Start calibration: lie down first, then sit up
  const startCalibration = useCallback(() => {
    resetCount();
    lyingSamplesRef.current = [];
    sittingSamplesRef.current = [];
    setCalibrationPhase("lying");
    setCalibration((prev) => ({ ...prev, done: false }));

    // After 3 seconds of collecting lying samples, switch to sitting
    calibrationTimerRef.current = setTimeout(() => {
      setCalibrationPhase("sitting");
      // After 3 more seconds, finish
      calibrationTimerRef.current = setTimeout(() => {
        setCalibrationPhase("none");
        setCalibration((prev) => ({ ...prev, done: true }));
      }, 3000);
    }, 3000);
  }, [resetCount]);

  // Manual rep button (fallback if AI detection doesn't work)
  const addManualRep = useCallback(() => {
    repCountRef.current += 1;
    setRepCount(repCountRef.current);
  }, []);

  return {
    repCount,
    currentAngle,
    error,
    resetCount,
    isInUpPhase,
    modelLoaded,
    calibration,
    calibrationPhase,
    startCalibration,
    addManualRep,
  };
}
