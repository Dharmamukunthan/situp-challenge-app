import { useEffect, useRef, useState, useCallback } from "react";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

/**
 * Situp counter — phone placed to the SIDE using BACK camera.
 *
 * Side-view geometry:
 *   Lying flat:  Shoulder-Hip-Knee angle ≈ 160-180° (body is straight)
 *   Sitting up:  Shoulder-Hip-Knee angle ≈ 50-100° (body is folded)
 *
 * We use WIDE thresholds so detection works in various positions.
 * One full rep = flat → folded → flat.
 */

const SMOOTH_WINDOW = 3;
const POSE_SCORE_THRESHOLD = 0.15;

// Wide thresholds — works in most lighting and positions
const LYING_ANGLE = 140;   // angle > 140° = lying down
const SITTING_ANGLE = 100;  // angle < 100° = sitting up
const COOLDOWN_FRAMES = 15; // ~0.5s at 30fps — fast enough for quick situps

function calcAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA < 1 || magBC < 1) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function usePoseDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean
) {
  const [repCount, setRepCount] = useState(0);
  const [isInUpPhase, setIsInUpPhase] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [debugInfo, setDebugInfo] = useState("");

  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const repCountRef = useRef(0);
  const cooldownRef = useRef(0);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const isInUpRef = useRef(false);
  const angleHistoryRef = useRef<number[]>([]);

  // Back camera first (side profile), then front as fallback
  const startCamera = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setError(null);
    } catch (err) {
      const name = (err as Error).name;
      if (name === "NotAllowedError") {
        setError("Camera permission denied. Allow it in browser settings.");
      } else {
        setError("Camera error: " + (err as Error).message);
      }
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    detectorRef.current?.dispose();
    detectorRef.current = null;
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
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      detectorRef.current = detector;
      setModelLoaded(true);
      return detector;
    } catch (err) {
      console.error("Model init failed:", err);
      setError("AI model failed to load. Use manual counting below.");
      return null;
    }
  }, []);

  const detectPose = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !detectorRef.current)
      return;

    try {
      const poses = await detectorRef.current.estimatePoses(video);
      if (poses.length === 0) {
        setDebugInfo("No pose detected — stand/sit in frame");
        return;
      }

      const kps = poses[0].keypoints;
      const kpMap = new Map(kps.map((k) => [k.name, k]));

      // Try each side independently, pick the one with best scores
      const sides = [
        {
          shoulder: kpMap.get("left_shoulder"),
          hip: kpMap.get("left_hip"),
          knee: kpMap.get("left_knee"),
        },
        {
          shoulder: kpMap.get("right_shoulder"),
          hip: kpMap.get("right_hip"),
          knee: kpMap.get("right_knee"),
        },
      ];

      let bestAngle = 180;
      let found = false;

      for (const side of sides) {
        const { shoulder, hip, knee } = side;
        if (
          shoulder && hip && knee &&
          (shoulder.score ?? 0) > POSE_SCORE_THRESHOLD &&
          (hip.score ?? 0) > POSE_SCORE_THRESHOLD &&
          (knee.score ?? 0) > POSE_SCORE_THRESHOLD
        ) {
          const angle = calcAngle(shoulder, hip, knee);
          bestAngle = angle;
          found = true;
          break;
        }
      }

      // Fallback: average both sides if individual sides fail
      if (!found) {
        const ls = kpMap.get("left_shoulder");
        const rs = kpMap.get("right_shoulder");
        const lh = kpMap.get("left_hip");
        const rh = kpMap.get("right_hip");
        const lk = kpMap.get("left_knee");
        const rk = kpMap.get("right_knee");

        if (ls && rs && lh && rh && lk && rk) {
          const avgS = {
            x: (ls.x + rs.x) / 2,
            y: (ls.y + rs.y) / 2,
          };
          const avgH = {
            x: (lh.x + rh.x) / 2,
            y: (lh.y + rh.y) / 2,
          };
          const avgK = {
            x: (lk.x + rk.x) / 2,
            y: (lk.y + rk.y) / 2,
          };
          bestAngle = calcAngle(avgS, avgH, avgK);
          found = true;
        }
      }

      if (!found) {
        setDebugInfo("Body not fully visible — move into frame");
        return;
      }

      // Smooth
      const history = angleHistoryRef.current;
      history.push(bestAngle);
      if (history.length > SMOOTH_WINDOW) history.shift();
      const smoothed = history.reduce((a, b) => a + b, 0) / history.length;

      setCurrentAngle(Math.round(smoothed));

      // Debug info
      const phase = isInUpRef.current ? "WAITING_LIE_DOWN" : "WAITING_SIT_UP";
      setDebugInfo(
        `Angle: ${Math.round(smoothed)}° | Phase: ${phase} | Thresholds: >${LYING_ANGLE}° / <${SITTING_ANGLE}°`
      );

      // Draw skeleton
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        const drawLine = (
          a: { x: number; y: number },
          b: { x: number; y: number },
          color: string,
          width: number
        ) => {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.stroke();
        };

        const bodyColor =
          smoothed > LYING_ANGLE
            ? "#ef4444"
            : smoothed < SITTING_ANGLE
              ? "#22c55e"
              : "#f59e0b";

        // Draw all connections
        const allConnections: [string, string][] = [
          ["left_shoulder", "right_shoulder"],
          ["left_shoulder", "left_elbow"],
          ["right_shoulder", "right_elbow"],
          ["left_elbow", "left_wrist"],
          ["right_elbow", "right_wrist"],
          ["left_hip", "right_hip"],
          ["left_hip", "left_knee"],
          ["right_hip", "right_knee"],
          ["left_knee", "left_ankle"],
          ["right_knee", "right_ankle"],
        ];

        for (const [a, b] of allConnections) {
          const ka = kpMap.get(a);
          const kb = kpMap.get(b);
          if (
            ka && kb &&
            (ka.score ?? 0) > POSE_SCORE_THRESHOLD &&
            (kb.score ?? 0) > POSE_SCORE_THRESHOLD
          ) {
            const isKeyLine =
              (a.includes("shoulder") && b.includes("hip")) ||
              (a.includes("hip") && b.includes("knee"));
            drawLine(
              ka,
              kb,
              isKeyLine ? bodyColor : "rgba(100,100,100,0.4)",
              isKeyLine ? 4 : 2
            );
          }
        }

        // Draw keypoints
        for (const kp of kps) {
          if ((kp.score ?? 0) > POSE_SCORE_THRESHOLD) {
            const isKey =
              kp.name?.includes("shoulder") ||
              kp.name?.includes("hip") ||
              kp.name?.includes("knee");
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, isKey ? 7 : 3, 0, 2 * Math.PI);
            ctx.fillStyle = isKey ? "#22c55e" : "#3b82f6";
            ctx.fill();
            if (isKey) {
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
        }

        // Draw angle text
        ctx.font = "bold 24px sans-serif";
        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        const angleText = `${Math.round(smoothed)}°`;
        ctx.strokeText(angleText, 20, 40);
        ctx.fillText(angleText, 20, 40);
      }

      // Rep counting
      if (cooldownRef.current > 0) {
        cooldownRef.current--;
        return;
      }

      if (!isInUpRef.current) {
        // Waiting for user to sit up (angle drops below SITTING_ANGLE)
        if (smoothed < SITTING_ANGLE) {
          isInUpRef.current = true;
          setIsInUpPhase(true);
          setDebugInfo("UP detected! Now lie back down...");
        }
      } else {
        // Waiting for user to lie back down (angle rises above LYING_ANGLE)
        if (smoothed > LYING_ANGLE) {
          // REP COMPLETE!
          repCountRef.current += 1;
          setRepCount(repCountRef.current);
          cooldownRef.current = COOLDOWN_FRAMES;
          isInUpRef.current = false;
          setIsInUpPhase(false);
          setDebugInfo(`REP #${repCountRef.current} counted!`);
        }
      }
    } catch (err) {
      setDebugInfo("Detection error: " + (err as Error).message);
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
      detectPose().then(() => {
        if (running) animFrameRef.current = requestAnimationFrame(loop);
      });
    };

    const init = async () => {
      await startCamera();
      if (!detectorRef.current) await initDetector();
      if (running) loop();
    };

    init();

    return () => {
      running = false;
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
    addManualRep,
    debugInfo,
  };
}
