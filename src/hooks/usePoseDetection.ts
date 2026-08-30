import { useEffect, useRef, useState, useCallback } from "react";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

/**
 * AI Situp Counter — full production implementation.
 *
 * Uses MoveNet Thunder (high accuracy) + dual detection:
 *   1. Shoulder-Hip-Knee angle at the hip joint
 *   2. Shoulder-hip vertical distance as % of frame height
 *
 * BOTH signals must agree for 10+ consecutive frames before a state
 * change is confirmed. This eliminates false positives from noise.
 *
 * Phone placement: SIDE VIEW (profile), back camera facing user.
 */

const CONFIRM_FRAMES = 10; // frames required to confirm state change
const POSE_SCORE_MIN = 0.2;
const COOLDOWN = 20; // frames after counting a rep (~0.6s)

// Angle thresholds
const LYING_ANGLE_MIN = 135;  // hip angle > 135° = lying
const SITTING_ANGLE_MAX = 105; // hip angle < 105° = sitting

// Distance thresholds (shoulder-hip Y distance as % of frame height)
const LYING_DIST_MAX = 0.18;  // distance < 18% = lying
const SITTING_DIST_MIN = 0.28; // distance > 28% = sitting

// Smoothing
const SMOOTH_FRAMES = 4;

type Phase = "idle" | "waiting_up" | "waiting_down";

function hipAngle(
  s: { x: number; y: number },
  h: { x: number; y: number },
  k: { x: number; y: number }
): number {
  const hs = { x: s.x - h.x, y: s.y - h.y };
  const hk = { x: k.x - h.x, y: k.y - h.y };
  const dot = hs.x * hk.x + hs.y * hk.y;
  const m1 = Math.sqrt(hs.x * hs.x + hs.y * hs.y);
  const m2 = Math.sqrt(hk.x * hk.x + hk.y * hk.y);
  if (m1 < 1 || m2 < 1) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180) / Math.PI;
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

  // Refs for the detection loop
  const animRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const repCountRef = useRef(0);
  const cooldownRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const confirmRef = useRef(0); // frames confirming current state
  const angleBuf = useRef<number[]>([]);
  const distBuf = useRef<number[]>([]);

  // Camera
  const startCamera = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setError(null);
    } catch (err) {
      setError("Camera error: " + (err as Error).message);
    }
  }, [videoRef]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    detectorRef.current?.dispose();
    detectorRef.current = null;
    angleBuf.current = [];
    distBuf.current = [];
    setModelLoaded(false);
  }, []);

  // Init with Thunder model (high accuracy)
  const initDetector = useCallback(async () => {
    try {
      const tf = await import("@tensorflow/tfjs-core");
      await tf.setBackend("webgl");
      await tf.ready();
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER }
      );
      detectorRef.current = detector;
      setModelLoaded(true);
      return detector;
    } catch (err) {
      console.error("Model init failed:", err);
      setError("AI model failed to load.");
      return null;
    }
  }, []);

  // Main detection
  const detect = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !detectorRef.current) return;

    try {
      const poses = await detectorRef.current.estimatePoses(video);
      if (poses.length === 0) {
        setDebugInfo("No body detected — move into frame");
        return;
      }

      const kps = poses[0].keypoints;
      const byName = new Map(kps.map((k) => [k.name, k]));

      // Find best visible side
      const sides = [
        { s: byName.get("left_shoulder"), h: byName.get("left_hip"), k: byName.get("left_knee") },
        { s: byName.get("right_shoulder"), h: byName.get("right_hip"), k: byName.get("right_knee") },
      ];

      let shoulder: { x: number; y: number } | null = null;
      let hip: { x: number; y: number } | null = null;
      let knee: { x: number; y: number } | null = null;

      for (const side of sides) {
        if (
          side.s && side.h && side.k &&
          (side.s.score ?? 0) > POSE_SCORE_MIN &&
          (side.h.score ?? 0) > POSE_SCORE_MIN &&
          (side.k.score ?? 0) > POSE_SCORE_MIN
        ) {
          shoulder = side.s;
          hip = side.h;
          knee = side.k;
          break;
        }
      }

      // Fallback: average both sides
      if (!shoulder || !hip || !knee) {
        const [l, r] = sides;
        if (l.s && r.s && l.h && r.h && l.k && r.k) {
          const avg = (a: number, b: number) => (a + b) / 2;
          shoulder = { x: avg(l.s.x, r.s.x), y: avg(l.s.y, r.s.y) };
          hip = { x: avg(l.h.x, r.h.x), y: avg(l.h.y, r.h.y) };
          knee = { x: avg(l.k.x, r.k.x), y: avg(l.k.y, r.k.y) };
        }
      }

      if (!shoulder || !hip || !knee) {
        setDebugInfo("Body not fully visible");
        return;
      }

      // === SIGNAL 1: Hip angle ===
      const rawAngle = hipAngle(shoulder, hip, knee);

      // === SIGNAL 2: Shoulder-hip vertical distance ===
      const frameH = video.videoHeight;
      const rawDist = Math.abs(shoulder.y - hip.y) / frameH;

      // Smooth both signals
      angleBuf.current.push(rawAngle);
      if (angleBuf.current.length > SMOOTH_FRAMES) angleBuf.current.shift();
      const angle =
        angleBuf.current.reduce((a, b) => a + b, 0) / angleBuf.current.length;

      distBuf.current.push(rawDist);
      if (distBuf.current.length > SMOOTH_FRAMES) distBuf.current.shift();
      const dist =
        distBuf.current.reduce((a, b) => a + b, 0) / distBuf.current.length;

      setCurrentAngle(Math.round(angle));

      // === CLASSIFY current position ===
      const isLying =
        angle > LYING_ANGLE_MIN && dist < LYING_DIST_MAX;
      const isSitting =
        angle < SITTING_ANGLE_MAX && dist > SITTING_DIST_MIN;

      // === STATE MACHINE with confirmation ===
      if (cooldownRef.current > 0) {
        cooldownRef.current--;
      setDebugInfo(
        `Cooldown ${cooldownRef.current} | Angle: ${Math.round(angle)}° Dist: ${(dist * 100).toFixed(0)}%`
      );
      // Still draw skeleton during cooldown
      const cooldownCtx = canvas.getContext("2d");
      if (cooldownCtx) {
        drawSkeleton(cooldownCtx, canvas, video, kps, byName as Map<string, poseDetection.Keypoint>, shoulder, hip, knee, angle, "#666");
      }
        return;
      }

      if (phaseRef.current === "idle") {
        // Start: wait for lying down
        if (isLying) {
          confirmRef.current++;
          if (confirmRef.current >= CONFIRM_FRAMES) {
            phaseRef.current = "waiting_up";
            confirmRef.current = 0;
            setIsInUpPhase(false);
          }
        } else {
          confirmRef.current = 0;
        }
      } else if (phaseRef.current === "waiting_up") {
        // User should sit up
        if (isSitting) {
          confirmRef.current++;
          if (confirmRef.current >= CONFIRM_FRAMES) {
            phaseRef.current = "waiting_down";
            confirmRef.current = 0;
            setIsInUpPhase(true);
          }
        } else if (isLying) {
          confirmRef.current = 0; // reset if went back to lying
        } else {
          confirmRef.current = Math.max(0, confirmRef.current - 1); // partial match decays
        }
      } else if (phaseRef.current === "waiting_down") {
        // User should lie back down
        if (isLying) {
          confirmRef.current++;
          if (confirmRef.current >= CONFIRM_FRAMES) {
            // REP COMPLETE!
            repCountRef.current += 1;
            setRepCount(repCountRef.current);
            cooldownRef.current = COOLDOWN;
            phaseRef.current = "idle";
            confirmRef.current = 0;
            setIsInUpPhase(false);
          }
        } else if (isSitting) {
          confirmRef.current = 0;
        } else {
          confirmRef.current = Math.max(0, confirmRef.current - 1);
        }
      }

      // Debug
      const posLabel = isLying ? "LYING" : isSitting ? "SITTING" : "MOVING";
      const phaseLabel = phaseRef.current;
      const conf = confirmRef.current;
      setDebugInfo(
        `${posLabel} | Angle: ${Math.round(angle)}° Dist: ${(dist * 100).toFixed(0)}% | Phase: ${phaseLabel} | Confirm: ${conf}/${CONFIRM_FRAMES}`
      );

      // Draw skeleton
      const drawCtx = canvas.getContext("2d");
      if (drawCtx) {
        drawSkeleton(drawCtx, canvas, video, kps, byName as Map<string, poseDetection.Keypoint>, shoulder, hip, knee, angle, isLying ? "#ef4444" : isSitting ? "#22c55e" : "#f59e0b");
      }
    } catch (err) {
      setDebugInfo("Error: " + (err as Error).message);
    }
  }, [videoRef, canvasRef]);

  // Draw skeleton helper
  function drawSkeleton(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    kps: poseDetection.Keypoint[],
    byName: Map<string, poseDetection.Keypoint>,
    shoulder: { x: number; y: number },
    hip: { x: number; y: number },
    knee: { x: number; y: number },
    angle: number,
    color: string
  ) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const line = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: string,
      w: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.stroke();
    };

    // All body connections
    const conns: [string, string][] = [
      ["left_shoulder", "right_shoulder"],
      ["left_shoulder", "left_elbow"], ["right_shoulder", "right_elbow"],
      ["left_elbow", "left_wrist"], ["right_elbow", "right_wrist"],
      ["left_hip", "right_hip"],
      ["left_hip", "left_knee"], ["right_hip", "right_knee"],
      ["left_knee", "left_ankle"], ["right_knee", "right_ankle"],
    ];

    for (const [a, b] of conns) {
      const ka = byName.get(a);
      const kb = byName.get(b);
      if (ka && kb && (ka.score ?? 0) > POSE_SCORE_MIN && (kb.score ?? 0) > POSE_SCORE_MIN) {
        line(ka, kb, "rgba(100,100,100,0.3)", 2);
      }
    }

    // Key chain: shoulder → hip → knee (thick, colored)
    line(shoulder, hip, color, 4);
    line(hip, knee, color, 4);

    // Keypoints
    for (const kp of kps) {
      if ((kp.score ?? 0) > POSE_SCORE_MIN) {
        const isKey = kp.name?.includes("shoulder") || kp.name?.includes("hip") || kp.name?.includes("knee");
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, isKey ? 6 : 3, 0, 2 * Math.PI);
        ctx.fillStyle = isKey ? color : "rgba(100,100,200,0.5)";
        ctx.fill();
      }
    }

    // Angle at hip
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = color;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    const txt = `${Math.round(angle)}°`;
    ctx.strokeText(txt, hip.x + 15, hip.y - 10);
    ctx.fillText(txt, hip.x + 15, hip.y - 10);
  }

  // Animation loop
  useEffect(() => {
    if (!enabled) { stopCamera(); return; }
    let running = true;
    const loop = () => {
      if (!running) return;
      detect().then(() => {
        if (running) animRef.current = requestAnimationFrame(loop);
      });
    };
    const init = async () => {
      await startCamera();
      if (!detectorRef.current) await initDetector();
      if (running) loop();
    };
    init();
    return () => { running = false; stopCamera(); };
  }, [enabled, startCamera, stopCamera, detect, initDetector]);

  const resetCount = useCallback(() => {
    repCountRef.current = 0;
    setRepCount(0);
    cooldownRef.current = 0;
    phaseRef.current = "idle";
    confirmRef.current = 0;
    angleBuf.current = [];
    distBuf.current = [];
    setIsInUpPhase(false);
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
