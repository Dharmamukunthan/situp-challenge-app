import { useEffect, useRef, useState, useCallback } from "react";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

/**
 * Real pose-detection-based situp counter.
 *
 * Uses TensorFlow.js + MoveNet to track shoulder & hip keypoints.
 * A situp is: torso angle goes from horizontal (lying) → vertical (sitting)
 * → back to horizontal (lying). One full cycle = 1 rep.
 */

function getTorsoAngle(
  shoulder: { x: number; y: number },
  hip: { x: number; y: number }
): number {
  // Angle of the torso line (hip→shoulder) relative to vertical (down = 0°)
  const dx = shoulder.x - hip.x;
  const dy = shoulder.y - hip.y; // y increases downward in screen coords
  // When lying flat: shoulder is directly above hip → angle ≈ 90°
  // When sitting up: shoulder is above and slightly forward → angle ≈ 0-20°
  const angleRad = Math.atan2(Math.abs(dx), -dy); // -dy because screen y is flipped
  return Math.abs((angleRad * 180) / Math.PI);
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

  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const repCountRef = useRef(0);
  const cooldownRef = useRef(0);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const isInUpRef = useRef(false);

  // Smoothed angle tracking
  const angleHistoryRef = useRef<number[]>([]);
  const SMOOTH_WINDOW = 5; // average over 5 frames

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
  }, []);

  // Initialize TF.js pose detector
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
      return detector;
    } catch (err) {
      console.error("Failed to init pose detector:", err);
      setError("Failed to load pose detection model. Check your connection.");
      return null;
    }
  }, []);

  // Core detection loop
  const detectPose = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !detectorRef.current)
      return;

    try {
      const poses = await detectorRef.current.estimatePoses(video);
      if (poses.length === 0) return;

      const keypoints = poses[0].keypoints;

      // Get shoulder and hip keypoints (average left/right)
      const leftShoulder = keypoints.find((kp) => kp.name === "left_shoulder");
      const rightShoulder = keypoints.find(
        (kp) => kp.name === "right_shoulder"
      );
      const leftHip = keypoints.find((kp) => kp.name === "left_hip");
      const rightHip = keypoints.find((kp) => kp.name === "right_hip");

      if (
        !leftShoulder ||
        !rightShoulder ||
        !leftHip ||
        !rightHip ||
        leftShoulder.score! < 0.3 ||
        rightShoulder.score! < 0.3 ||
        leftHip.score! < 0.3 ||
        rightHip.score! < 0.3
      ) {
        return; // Not enough confidence — skip this frame
      }

      // Average left/right for center points
      const shoulder = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      const hip = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
      };

      // Calculate torso angle (horizontal = ~90°, upright = ~0°)
      const rawAngle = getTorsoAngle(shoulder, hip);

      // Smooth the angle to avoid jitter
      const history = angleHistoryRef.current;
      history.push(rawAngle);
      if (history.length > SMOOTH_WINDOW) history.shift();
      const smoothedAngle =
        history.reduce((a, b) => a + b, 0) / history.length;

      setCurrentAngle(Math.round(smoothedAngle));

      // Draw skeleton on canvas
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Mirror the canvas to match the mirrored video
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        // Draw torso line (hip → shoulder)
        ctx.beginPath();
        ctx.moveTo(hip.x, hip.y);
        ctx.lineTo(shoulder.x, shoulder.y);
        ctx.strokeStyle =
          smoothedAngle < 35
            ? "#22c55e"
            : smoothedAngle > 60
              ? "#ef4444"
              : "#f59e0b";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw keypoints
        for (const kp of keypoints) {
          if (kp.score && kp.score > 0.3) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle =
              kp.name?.includes("shoulder") || kp.name?.includes("hip")
                ? "#3b82f6"
                : "#6b7280";
            ctx.fill();
          }
        }

        // Draw angle label
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${Math.round(smoothedAngle)}°`, 20, 30);

        ctx.restore();
      }

      // Situp rep detection
      // Lying down: angle > 60° (torso is roughly horizontal)
      // Sitting up: angle < 35° (torso is roughly vertical)
      const LYING_THRESHOLD = 60;
      const SITTING_THRESHOLD = 35;

      if (cooldownRef.current > 0) {
        cooldownRef.current--;
      }

      if (!isInUpRef.current) {
        // Looking for transition to sitting up
        if (smoothedAngle < SITTING_THRESHOLD) {
          isInUpRef.current = true;
          setIsInUpPhase(true);
        }
      } else {
        // In up phase, looking for transition back to lying
        if (smoothedAngle > LYING_THRESHOLD) {
          // Full situp completed!
          if (cooldownRef.current === 0) {
            repCountRef.current += 1;
            setRepCount(repCountRef.current);
            cooldownRef.current = 30; // ~0.5s cooldown
          }
          isInUpRef.current = false;
          setIsInUpPhase(false);
        }
      }
    } catch {
      // Pose estimation failed on this frame — skip
    }
  }, [videoRef, canvasRef]);

  useEffect(() => {
    if (!enabled) {
      stopCamera();
      return;
    }

    let running = true;

    const loop = async () => {
      if (!running) return;
      await detectPose();
      animFrameRef.current = requestAnimationFrame(() => loop());
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

  return {
    repCount,
    currentAngle,
    error,
    resetCount,
    isInUpPhase,
  };
}
