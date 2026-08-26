import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import {
  Swords,
  Clock,
  Camera,
  CameraOff,
  Trophy,
  Users,
  Copy,
  Check,
  RotateCcw,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type BattlePhase = "lobby" | "waiting" | "countdown" | "active" | "finished";

interface BattleSystemProps {
  onBack: () => void;
}

export function BattleSystem({ onBack }: BattleSystemProps) {
  const { user } = useAuth();
  const userId = user?._id ?? "";
  const [phase, setPhase] = useState<BattlePhase>("lobby");
  const [duration, setDuration] = useState(60);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleCode, setBattleCode] = useState<string>("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [winner, setWinner] = useState<"me" | "opponent" | "draw" | null>(null);

  const createBattle = useMutation(api.battles.createBattle);
  const joinBattle = useMutation(api.battles.joinBattle);
  const updateScore = useMutation(api.battles.updateScore);
  const endBattle = useMutation(api.battles.endBattle);
  const battle = useQuery(
    api.battles.getBattle,
    battleId ? { battleId: battleId as any } : "skip"
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { repCount, resetCount, error } = usePoseDetection(
    videoRef,
    canvasRef,
    phase === "active"
  );

  // Update my score when repCount changes
  useEffect(() => {
    if (phase === "active" && battleId && userId) {
      setMyScore(repCount);
      updateScore({ battleId: battleId as any, userId, score: repCount });
    }
  }, [repCount, phase, battleId, userId, updateScore]);

  // Sync opponent score from battle
  useEffect(() => {
    if (!battle || !userId) return;
    if (battle.creatorId === userId) {
      setOpponentScore(battle.opponentScore);
    } else {
      setOpponentScore(battle.creatorScore);
    }
  }, [battle, userId]);

  // Watch for opponent joining
  useEffect(() => {
    if (phase === "waiting" && battle?.status === "active") {
      startCountdown();
    }
  }, [battle?.status, phase]);

  const startCountdown = useCallback(() => {
    setPhase("countdown");
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setPhase("active");
          setTimeLeft(duration);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [duration]);

  // Battle timer
  useEffect(() => {
    if (phase !== "active") return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          finishBattle();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const finishBattle = useCallback(() => {
    setPhase("finished");
    if (battleId) endBattle({ battleId: battleId as any });
    if (myScore > opponentScore) setWinner("me");
    else if (opponentScore > myScore) setWinner("opponent");
    else setWinner("draw");
  }, [battleId, myScore, opponentScore, endBattle]);

  const handleCreateBattle = async () => {
    const result = await createBattle({ creatorId: userId, duration });
    setBattleId(result.id);
    setBattleCode(result.code);
    setPhase("waiting");
  };

  const handleJoinBattle = async () => {
    if (!joinCode.trim()) return;
    try {
      const id = await joinBattle({
        battleCode: joinCode.toUpperCase().trim(),
        opponentId: userId,
      });
      setBattleId(id);
      startCountdown();
    } catch {
      alert("Invalid battle code or battle already started");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(battleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBattleUrl = () => {
    return `${window.location.origin}/dashboard?battle=${battleCode}`;
  };

  const resetBattle = () => {
    setPhase("lobby");
    setBattleId(null);
    setBattleCode("");
    setMyScore(0);
    setOpponentScore(0);
    setWinner(null);
    resetCount();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // LOBBY
  if (phase === "lobby") {
    return (
      <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
        <div className="clay-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-[var(--clay-radius)] bg-[var(--primary)] flex items-center justify-center">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">1v1 Battle</h2>
              <p className="text-sm text-muted-foreground">Challenge a friend to situps!</p>
            </div>
          </div>

          {/* Duration picker */}
          <div className="mb-6">
            <label className="text-sm font-medium text-foreground mb-3 block">Battle Duration</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 10, label: "10s", icon: "⚡" },
                { value: 60, label: "1 min", icon: "🕐" },
                { value: 300, label: "5 min", icon: "🏆" },
              ].map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`clay-card p-4 text-center transition-all ${
                    duration === d.value
                      ? "ring-2 ring-[var(--primary)] bg-[var(--primary)]/10"
                      : "hover:bg-[var(--accent)]/10"
                  }`}
                >
                  <span className="text-2xl block mb-1">{d.icon}</span>
                  <span className="text-sm font-semibold text-foreground">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Create battle */}
          <Button onClick={handleCreateBattle} className="clay-btn w-full h-12 text-base font-semibold mb-4">
            <Swords className="w-5 h-5 mr-2" />
            Create Battle
          </Button>

          {/* Join battle */}
          <div className="clay-inset p-4">
            <label className="text-sm font-medium text-foreground mb-2 block">Join with Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={6}
                className="flex-1 h-12 text-center text-lg font-mono font-bold tracking-[0.3em] rounded-[var(--clay-radius)] bg-background border border-[var(--border)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <Button onClick={handleJoinBattle} className="clay-btn h-12 px-6">
                Join
              </Button>
            </div>
          </div>
        </div>

        <Button onClick={onBack} variant="ghost" className="w-full">
          ← Back
        </Button>
      </div>
    );
  }

  // WAITING
  if (phase === "waiting") {
    return (
      <div className="flex flex-col gap-6 w-full max-w-md mx-auto items-center">
        <div className="clay-card-lg p-8 text-center w-full">
          <div className="w-16 h-16 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Waiting for opponent...</h2>
          <p className="text-muted-foreground mb-6">Share this code or scan the QR</p>

          {/* Battle code */}
          <div className="clay-inset p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-1">Battle Code</p>
            <p className="text-4xl font-mono font-bold tracking-[0.3em] text-foreground">{battleCode}</p>
          </div>

          {/* Copy & share */}
          <div className="flex gap-2 mb-6">
            <Button onClick={copyCode} className="clay-btn flex-1 h-12">
              {copied ? <Check className="w-5 h-5 mr-2" /> : <Copy className="w-5 h-5 mr-2" />}
              {copied ? "Copied!" : "Copy Code"}
            </Button>
          </div>

          {/* QR Code */}
          <div className="clay-card p-6 inline-block">
            <QRCodeSVG value={getBattleUrl()} size={180} bgColor="transparent" fgColor="var(--foreground)" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">Scan to join this battle</p>

          {/* Waiting animation */}
          <div className="flex justify-center gap-1 mt-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-[var(--primary)] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>

        <Button onClick={resetBattle} variant="ghost" className="w-full">
          Cancel Battle
        </Button>
      </div>
    );
  }

  // COUNTDOWN
  if (phase === "countdown") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="clay-counter w-40 h-40 text-7xl font-black animate-pulse">
          {countdown}
        </div>
        <p className="text-xl text-muted-foreground mt-6 font-medium">Get ready!</p>
      </div>
    );
  }

  // ACTIVE BATTLE
  if (phase === "active") {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
        {/* Timer */}
        <div className="clay-card-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-[var(--primary)]" />
            <span className="text-4xl font-black text-foreground font-mono">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-2 gap-3">
          <div className="clay-card p-4 text-center ring-2 ring-[var(--primary)]/50">
            <p className="text-xs text-muted-foreground mb-1">You</p>
            <p className="text-4xl font-black text-[var(--primary)]">{myScore}</p>
          </div>
          <div className="clay-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Opponent</p>
            <p className="text-4xl font-black text-foreground">{opponentScore}</p>
          </div>
        </div>

        {/* Camera */}
        <div className="relative clay-card-lg overflow-hidden">
          <div className="aspect-[4/3] bg-muted">
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
            {/* Rep overlay */}
            <div className="absolute top-3 left-3 clay-pill bg-background/80 backdrop-blur-sm px-4 py-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[var(--primary)]" />
                <span className="font-bold text-xl text-foreground">{myScore}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="clay-card p-3 border-red-400/50">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // FINISHED
  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto items-center">
      <div className="clay-card-lg p-8 text-center w-full">
        <div className="mb-4">
          {winner === "me" && <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />}
          {winner === "opponent" && <Trophy className="w-16 h-16 text-gray-400 mx-auto" />}
          {winner === "draw" && <Swords className="w-16 h-16 text-[var(--primary)] mx-auto" />}
        </div>

        <h2 className="text-3xl font-black text-foreground mb-2">
          {winner === "me" && "🎉 You Win!"}
          {winner === "opponent" && "😤 You Lose!"}
          {winner === "draw" && "🤝 Draw!"}
        </h2>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="clay-card p-4 text-center">
            <p className="text-xs text-muted-foreground">You</p>
            <p className="text-3xl font-black text-foreground">{myScore}</p>
          </div>
          <div className="clay-card p-4 text-center">
            <p className="text-xs text-muted-foreground">Opponent</p>
            <p className="text-3xl font-black text-foreground">{opponentScore}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 w-full">
        <Button onClick={resetBattle} className="clay-btn flex-1 h-12">
          <RotateCcw className="w-5 h-5 mr-2" />
          New Battle
        </Button>
        <Button onClick={onBack} className="clay-btn flex-1 h-12" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}>
          Back to Menu
        </Button>
      </div>
    </div>
  );
}
