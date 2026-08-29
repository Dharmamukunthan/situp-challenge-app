import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import {
  Swords,
  Clock,
  CameraOff,
  Trophy,
  Users,
  Copy,
  Check,
  RotateCcw,
  Zap,
  ExternalLink,
  Loader2,
  Globe,
  Lock,
  Search,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type BattlePhase = "lobby" | "searching" | "waiting" | "countdown" | "active" | "finished";
type BattleMode = "random" | "private";

interface BattleSystemProps {
  onBack: () => void;
  initialBattleCode?: string;
  userId: string;
  username: string;
}

export function BattleSystem({ onBack, initialBattleCode, userId, username }: BattleSystemProps) {
  const [mode, setMode] = useState<BattleMode | null>(initialBattleCode ? "private" : null);
  const [phase, setPhase] = useState<BattlePhase>("lobby");
  const [duration, setDuration] = useState(60);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleCode, setBattleCode] = useState<string>("");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [winner, setWinner] = useState<"me" | "opponent" | "draw" | null>(null);
  const myScoreRef = useRef(0);
  const opponentScoreRef = useRef(0);
  const durationRef = useRef(duration);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Convex mutations/queries
  const createBattle = useMutation(api.battles.createBattle);
  const joinBattle = useMutation(api.battles.joinBattle);
  const updateScore = useMutation(api.battles.updateScore);
  const endBattle = useMutation(api.battles.endBattle);
  const findMatch = useMutation(api.matchmaking.findMatch);
  const cancelMatch = useMutation(api.matchmaking.cancelMatch);
  const getMyMatch = useQuery(
    api.matchmaking.getMyMatch,
    phase === "searching" ? { userId } : "skip"
  );
  const battle = useQuery(
    api.battles.getBattle,
    battleId ? { battleId: battleId as any } : "skip"
  );

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { repCount, resetCount, error } = usePoseDetection(
    videoRef,
    canvasRef,
    phase === "active"
  );

  // Sync duration from battle doc (for joiners)
  useEffect(() => {
    if (battle && battle.creatorId !== userId) {
      setDuration(battle.duration);
    }
  }, [battle, userId]);

  // Update my score (throttled)
  const lastScoreUpdateRef = useRef(0);
  useEffect(() => {
    if (phase === "active" && battleId) {
      setMyScore(repCount);
      myScoreRef.current = repCount;
      const now = Date.now();
      if (now - lastScoreUpdateRef.current > 1000) {
        lastScoreUpdateRef.current = now;
        updateScore({ battleId: battleId as any, userId, score: repCount });
      }
    }
  }, [repCount, phase, battleId, userId, updateScore]);

  // Flush final score on battle end
  useEffect(() => {
    if (phase === "finished" && battleId) {
      updateScore({ battleId: battleId as any, userId, score: myScoreRef.current });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Sync opponent score
  useEffect(() => {
    if (!battle) return;
    if (battle.creatorId === userId) {
      setOpponentScore(battle.opponentScore);
      opponentScoreRef.current = battle.opponentScore;
    } else {
      setOpponentScore(battle.creatorScore);
      opponentScoreRef.current = battle.creatorScore;
    }
  }, [battle, userId]);

  // Start countdown
  const startCountdown = useCallback(() => {
    setPhase("countdown");
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setPhase("active");
          setTimeLeft(durationRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  // Watch for opponent joining (private room waiting)
  useEffect(() => {
    if (phase === "waiting" && battle?.status === "active") {
      startCountdown();
    }
  }, [battle?.status, phase, startCountdown]);

  // Watch for match found (random matchmaking)
  useEffect(() => {
    if (phase === "searching" && getMyMatch?.battleId) {
      setBattleId(getMyMatch.battleId);
      setPhase("countdown");
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            setPhase("active");
            setTimeLeft(durationRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
  }, [getMyMatch, phase]);

  // Battle timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const my = myScoreRef.current;
    const opp = opponentScoreRef.current;
    if (my > opp) setWinner("me");
    else if (opp > my) setWinner("opponent");
    else setWinner("draw");
  }, [battleId, endBattle]);

  // --- Random Match ---
  const handleFindMatch = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      setPhase("searching");
      const result = await findMatch({ userId, username, duration });
      if (result) {
        // Immediately matched
        setBattleId(result);
        startCountdown();
      }
      // Otherwise polling effect will detect the match
    } catch {
      setPhase("lobby");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelSearch = async () => {
    await cancelMatch({ userId });
    setPhase("lobby");
  };

  // --- Private Room ---
  const handleCreateRoom = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const result = await createBattle({ creatorId: userId, duration });
      setBattleId(result.id);
      setBattleCode(result.code);
      setPhase("waiting");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinWithCode = async (code: string) => {
    if (!code.trim() || isJoining) return;
    setIsJoining(true);
    try {
      const id = await joinBattle({
        battleCode: code.toUpperCase().trim(),
        opponentId: userId,
      });
      setBattleId(id);
      startCountdown();
    } catch {
      alert("Invalid battle code or battle already started");
    } finally {
      setIsJoining(false);
    }
  };

  // Auto-join from QR code URL
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialBattleCode && phase === "lobby" && mode === "private") {
      setJoinCode(initialBattleCode);
      const timer = setTimeout(() => {
        handleJoinWithCode(initialBattleCode);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialBattleCode]);

  const copyCode = () => {
    navigator.clipboard.writeText(battleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBattleUrl = () => `${window.location.origin}/dashboard?battle=${battleCode}`;

  const resetAll = () => {
    setMode(null);
    setPhase("lobby");
    setBattleId(null);
    setBattleCode("");
    setMyScore(0);
    setOpponentScore(0);
    setWinner(null);
    setDuration(60);
    setTimeLeft(60);
    resetCount();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ========================================
  // MODE SELECTOR — shown when no mode chosen
  // ========================================
  if (!mode) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
        <div className="clay-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--primary)] flex items-center justify-center">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Head-to-Head</h2>
              <p className="text-xs text-muted-foreground">Choose how you want to compete.</p>
            </div>
          </div>

          {/* Duration picker — always visible before choosing mode */}
          <div className="mb-4">
            <label className="text-xs font-medium text-foreground mb-2 block">Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 30, label: "30s" },
                { value: 60, label: "1 min" },
                { value: 300, label: "5 min" },
              ].map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`clay-card py-3 text-center transition-all ${
                    duration === d.value
                      ? "ring-2 ring-[var(--primary)] bg-[var(--primary)]/10"
                      : "hover:bg-[var(--accent)]/10"
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Two mode buttons */}
          <button
            onClick={() => setMode("random")}
            className="clay-card w-full p-4 flex items-center gap-3 mb-3 hover:bg-[var(--accent)]/10 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6 text-[var(--primary)]" />
            </div>
            <div>
              <p className="font-bold text-foreground">Random Match</p>
              <p className="text-xs text-muted-foreground">Compete against a random online player</p>
            </div>
          </button>

          <button
            onClick={() => setMode("private")}
            className="clay-card w-full p-4 flex items-center gap-3 hover:bg-[var(--accent)]/10 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-[var(--clay-radius)] bg-[var(--accent)]/20 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-[var(--accent-foreground)]" />
            </div>
            <div>
              <p className="font-bold text-foreground">Private Room</p>
              <p className="text-xs text-muted-foreground">Create a room and invite friends with a code</p>
            </div>
          </button>
        </div>

        <Button onClick={onBack} variant="ghost" className="w-full h-10 text-sm">
          ← Back
        </Button>
      </div>
    );
  }

  // ========================================
  // RANDOM MATCH — searching
  // ========================================
  if (mode === "random" && phase === "searching") {
    return (
      <div className="flex flex-col gap-6 w-full max-w-md mx-auto items-center">
        <div className="clay-card-lg p-8 text-center w-full">
          <div className="w-16 h-16 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-[var(--primary)] animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Finding opponent</h2>
          <p className="text-muted-foreground mb-4">
            Searching for a player with {duration >= 60 ? `${duration / 60} min` : `${duration}s`} duration...
          </p>

          <div className="flex justify-center gap-1 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-[var(--primary)] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            You: <span className="font-semibold text-foreground">{username}</span>
          </p>
        </div>

        <Button onClick={handleCancelSearch} variant="ghost" className="w-full">
          Cancel
        </Button>
      </div>
    );
  }

  // ========================================
  // PRIVATE ROOM — lobby (create / join)
  // ========================================
  if (mode === "private" && phase === "lobby") {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
        <div className="clay-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--accent)]/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[var(--accent-foreground)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Private Room</h2>
              <p className="text-xs text-muted-foreground">Create a room or join with a code.</p>
            </div>
          </div>

          {/* Duration picker */}
          <div className="mb-4">
            <label className="text-xs font-medium text-foreground mb-2 block">Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 30, label: "30s" },
                { value: 60, label: "1 min" },
                { value: 300, label: "5 min" },
              ].map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`clay-card py-3 text-center transition-all ${
                    duration === d.value
                      ? "ring-2 ring-[var(--primary)] bg-[var(--primary)]/10"
                      : "hover:bg-[var(--accent)]/10"
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Create room */}
          <Button onClick={handleCreateRoom} disabled={isCreating} className="clay-btn w-full h-11 text-sm font-semibold mb-4">
            {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Swords className="w-4 h-4 mr-2" />}
            {isCreating ? "Creating..." : "Create Room"}
          </Button>

          {/* Join with code */}
          <div className="clay-inset p-3">
            <label className="text-xs font-medium text-foreground mb-2 block">Join with Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={6}
                className="flex-1 h-11 text-center text-base font-mono font-bold tracking-[0.3em] rounded-[var(--clay-radius)] bg-background border border-[var(--border)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <Button onClick={() => handleJoinWithCode(joinCode)} disabled={isJoining || !joinCode.trim()} className="clay-btn h-11 px-5 text-sm">
                {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
              </Button>
            </div>
          </div>
        </div>

        <Button onClick={() => setMode(null)} variant="ghost" className="w-full h-10 text-sm">
          ← Back
        </Button>
      </div>
    );
  }

  // ========================================
  // PRIVATE ROOM — waiting for friend to join
  // ========================================
  if (phase === "waiting") {
    return (
      <div className="flex flex-col gap-6 w-full max-w-md mx-auto items-center">
        <div className="clay-card-lg p-8 text-center w-full">
          <div className="w-16 h-16 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Waiting for opponent</h2>
          <p className="text-muted-foreground mb-6">Share the code or scan the QR to join.</p>

          {/* Battle code */}
          <div className="clay-inset p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-1">Room Code</p>
            <p className="text-4xl font-mono font-bold tracking-[0.3em] text-foreground">{battleCode}</p>
          </div>

          {/* Copy */}
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
          <p className="text-xs text-muted-foreground mt-3">Scan to join this room</p>

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

        <Button onClick={resetAll} variant="ghost" className="w-full">
          Cancel Room
        </Button>
      </div>
    );
  }

  // ========================================
  // COUNTDOWN (shared by both modes)
  // ========================================
  if (phase === "countdown") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="clay-counter w-40 h-40 text-7xl font-black animate-pulse">
          {countdown}
        </div>
        <p className="text-xl text-muted-foreground mt-6 font-medium">Stand by</p>
      </div>
    );
  }

  // ========================================
  // ACTIVE BATTLE (shared)
  // ========================================
  if (phase === "active") {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
        <div className="clay-card-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-[var(--primary)]" />
            <span className="text-4xl font-black text-foreground font-mono">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

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
            <div className="absolute top-3 left-3 clay-pill bg-background/80 backdrop-blur-sm px-4 py-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[var(--primary)]" />
                <span className="font-bold text-xl text-foreground">{myScore}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="clay-card p-3">
            {error === "CAMERA_BLOCKED_IFRAME" ? (
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">Camera unavailable in preview</p>
                <p className="text-xs text-muted-foreground mb-2">Open in a full tab to use the camera.</p>
                <Button
                  onClick={() => window.open(window.location.href, "_blank")}
                  className="clay-btn h-8 px-4 text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open in New Tab
                </Button>
              </div>
            ) : (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ========================================
  // FINISHED (shared)
  // ========================================
  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto items-center">
      <div className="clay-card-lg p-8 text-center w-full">
        <div className="mb-4">
          {winner === "me" && <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />}
          {winner === "opponent" && <Trophy className="w-16 h-16 text-gray-400 mx-auto" />}
          {winner === "draw" && <Swords className="w-16 h-16 text-[var(--primary)] mx-auto" />}
        </div>

        <h2 className="text-3xl font-black text-foreground mb-2">
          {winner === "me" && "Victory"}
          {winner === "opponent" && "Defeat"}
          {winner === "draw" && "Draw"}
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
        <Button onClick={resetAll} className="clay-btn flex-1 h-12">
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
