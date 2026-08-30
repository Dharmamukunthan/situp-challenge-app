import { useEffect, useRef, useState, useCallback } from "react";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

/**
 * Situp counter using TensorFlow.js MoveNet.
 *
 * CRITICAL: Phone must be placed to the SIDE of the user (profile view).
 * Front view cannot track situp motion because the body moves toward/away
 * from the camera (Z-axis) which is invisible in 2D.
 *
 * Side view geometry:
 * - Lying down: Shoulder-Hip-Knee angle ≈ 160-180° (body flat)
 * - Sitting up: Shoulder-Hip-Knee angle ≈ 40-80° (body folded)
 *
 * One rep = angle goes from flat → folded → flat
 */

const SMOOTH_WINDOW = 5;
const POSE_SCORE_THRESHOLD = 0.2;

// Calculate angle between three points (in degrees)
function calcAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  // Angle at point b, between lines b→a and b→c
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA === 0 || magBC === 0) return 180;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

// Default thresholds
const LYING_ANGLE = 150; // body flat when angle > 150°
const SITTING_ANGLE = 80; // body folded when angle < 80°

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

  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const repCountRef = useRef(0);
  const cooldownRef = useRef(0);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const isInUpRef = useRef(false);
  const angleHistoryRef = useRef<number[]>([]);

  const startCamera = useCallback(async () => {
    try {
      // Try back camera first (for side profile), fall back to front
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
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
        setError("Camera permission denied. Allow camera in settings and reload.");
      } else if (name === "NotFoundError") {
        setError("No camera found.");
      } else {
        setError("Camera error: " + (err as Error).message);
      }
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      detectorRef.current = detector;
      setModelLoaded(true);
      return detector;
    } catch (err) {
      console.error("Pose detector init failed:", err);
      setError("Failed to load AI model. Check internet connection.");
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
      if (poses.length === 0) return;

      const kps = poses[0].keypoints;
      const kpMap = new Map(kps.map((k) => [k.name, k]));

      const ls = kpMap.get("left_shoulder");
      const rs = kpMap.get("right_shoulder");
      const lh = kpMap.get("left_hip");
      const rh = kpMap.get("right_hip");
      const lk = kpMap.get("left_knee");
      const rk = kpMap.get("right_knee");

      // Get best visible side (use whichever side has higher scores)
      const leftScore =
        (ls?.score ?? 0) + (lh?.score ?? 0) + (lk?.score ?? 0);
      const rightScore =
        (rs?.score ?? 0) + (rh?.score ?? 0) + (rk?.score ?? 0);

      let shoulder: { x: number; y: number } | null = null;
      let hip: { x: number; y: number } | null = null;
      let knee: { x: number; y: number } | null = null;

      if (leftScore >= rightScore) {
        if (
          ls && lh && lk &&
          (ls.score ?? 0) > POSE_SCORE_THRESHOLD &&
          (lh.score ?? 0) > POSE_SCORE_THRESHOLD &&
          (lk.score ?? 0) > POSE_SCORE_THRESHOLD
        ) {
          shoulder = ls;
          hip = lh;
          knee = lk;
        }
      } else {
        if (
          rs && rh && rk &&
          (rs.score ?? 0) > POSE_SCORE_THRESHOLD &&
          (rh.score ?? 0) > POSE_SCORE_THRESHOLD &&
          (rk.score ?? 0) > POSE_SCORE_THRESHOLD
        ) {
          shoulder = rs;
          hip = rh;
          knee = rk;
        }
      }

      // Fallback: use averages of left and right
      if (!shoulder || !hip || !knee) {
        if (ls && rs && lh && rh && lk && rk) {
          const avgScore =
            ((ls.score ?? 0) + (rs.score ?? 0) +
              (lh.score ?? 0) + (rh.score ?? 0) +
              (lk.score ?? 0) + (rk.score ?? 0)) / 6;
          if (avgScore > POSE_SCORE_THRESHOLD) {
            shoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
            hip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
            knee = { x: (lk.x + rk.x) / 2, y: (lk.y + rk.y) / 2 };
          }
        }
      }

      if (!shoulder || !hip || !knee) return;

      // Calculate Shoulder-Hip-Knee angle
      const rawAngle = calcAngle(shoulder, hip, knee);

      // Smooth
      const history = angleHistoryRef.current;
      history.push(rawAngle);
      if (history.length > SMOOTH_WINDOW) history.shift();
      const smoothed = history.reduce((a, b) => a + b, 0) / history.length;

      setCurrentAngle(Math.round(smoothed));

      // Draw skeleton on canvas
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        // Draw body lines
        const drawLine = (
          a: { x: number; y: number },
          b: { x: number; y: number },
          color: string
        ) => {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.stroke();
        };

        const bodyColor =
          smoothed > LYING_ANGLE
            ? "#ef4444"
            : smoothed < SITTING_ANGLE
              ? "#22c55e"
              : "#f59e0b";

        // Shoulder→Hip→Knee (the critical chain)
        drawLine(shoulder, hip, bodyColor);
        drawLine(hip, knee, bodyColor);

        // Draw all detected connections
        const connections: [string, string][] = [
          ["left_shoulder", "right_shoulder"],
          ["left_shoulder", "left_elbow"],
          ["right_shoulder", "right_elbow"],
          ["left_elbow", "left_wrist"],
          ["right_elbow", "right_wrist"],
          ["left_hip", "right_hip"],
        ];

        for (const [a, b] of connections) {
          const ka = kpMap.get(a);
          const kb = kpMap.get(b);
          if (
            ka && kb &&
            (ka.score ?? 0) > POSE_SCORE_THRESHOLD &&
            (kb.score ?? 0) > POSE_SCORE_THRESHOLD
          ) {
            drawLine(ka, kb, "rgba(59, 130, 246, 0.5)");
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
            ctx.arc(kp.x, kp.y, isKey ? 6 : 3, 0, 2 * Math.PI);
            ctx.fillStyle = isKey ? "#22c55e" : "#3b82f6";
            ctx.fill();
          }
        }

        // Draw angle at hip
        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        const label = `${Math.round(smoothed)}°`;
        ctx.strokeText(label, hip.x + 15, hip.y - 15);
        ctx.fillText(label, hip.x + 15, hip.y - 15);

        // Status text
        ctx.font = "14px sans-serif";
        const status =
          smoothed > LYING_ANGLE
            ? "LYING — Sit up!"
            : smoothed < SITTING_ANGLE
              ? "SITTING — Lie back down!"
              : "MOVING...";
        ctx.fillStyle =
          smoothed > LYING_ANGLE
            ? "#ef4444"
            : smoothed < SITTING_ANGLE
              ? "#22c55e"
              : "#f59e0b";
        ctx.fillText(status, 15, 30);

        ctx.restore();
      }

      // Rep counting
      if (cooldownRef.current > 0) cooldownRef.current--;

      if (!isInUpRef.current) {
        // Waiting for sit-up (angle decreases)
        if (smoothed < SITTING_ANGLE) {
          isInUpRef.current = true;
          setIsInUpPhase(true);
        }
      } else {
        // Waiting for lie-down (angle increases back)
        if (smoothed > LYING_ANGLE) {
          if (cooldownRef.current === 0) {
            repCountRef.current += 1;
            setRepCount(repCountRef.current);
            cooldownRef.current = 50; // ~0.8s cooldown
          }
          isInUpRef.current = false;
          setIsInUpPhase(false);
        }
      }
    } catch {
      // Skip frame
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

  // Manual rep fallback
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
  };
}
