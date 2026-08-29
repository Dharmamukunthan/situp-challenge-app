import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Swords,
  Trophy,
  Sun,
  Moon,
  Shield,
  Flame,
  TrendingUp,
  Target,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import { CameraCounter } from "@/components/CameraCounter";
import { BattleSystem } from "@/components/BattleSystem";

type Tab = "counter" | "battles" | "leaderboard";

function getLocalDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Username prompt for users without one
function UsernamePrompt({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const checkUsername = useQuery(api.username.checkUsername, input.length >= 2 ? { username: input } : "skip");
  const setUsername = useMutation(api.username.setUsername);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await setUsername({ userId, username: input.trim().toLowerCase() });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set username");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="clay-card-lg p-6 w-full max-w-sm">
        <div className="w-14 h-14 rounded-full bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-7 h-7 text-[var(--primary)]" />
        </div>
        <h2 className="text-xl font-bold text-center text-foreground mb-1">Pick a Username</h2>
        <p className="text-sm text-muted-foreground text-center mb-5">
          Choose a unique name. This identifies you in battles and the leaderboard. It cannot be changed later.
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(null); }}
          placeholder="e.g. situpking42"
          maxLength={16}
          className="w-full h-12 text-center text-lg font-semibold rounded-[var(--clay-radius)] bg-background border border-[var(--border)] px-4 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] mb-2"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        {/* Live availability check */}
        {input.length >= 2 && checkUsername && (
          <p className={`text-xs text-center mb-3 ${checkUsername.valid ? "text-green-500" : "text-red-400"}`}>
            {checkUsername.valid ? "✓ Available" : checkUsername.error}
          </p>
        )}
        {error && <p className="text-xs text-center text-red-400 mb-3">{error}</p>}
        <Button
          onClick={handleSubmit}
          disabled={loading || !input.trim() || (checkUsername ? !checkUsername.valid : false)}
          className="clay-btn w-full h-12 text-sm font-semibold"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {loading ? "Setting..." : "Confirm Username"}
        </Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    return searchParams.get("battle") ? "battles" as Tab : "counter";
  });
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

  const logSession = useMutation(api.situpLogs.logSession);

  const dailyCount = useQuery(
    api.situpLogs.getTodayCount,
    user ? { userId: user._id } : "skip"
  ) ?? 0;
  const history = useQuery(
    api.situpLogs.getHistory,
    user ? { userId: user._id } : "skip"
  );
  const dailyGoal = 100;
  const goalProgress = Math.min(100, Math.round((dailyCount / dailyGoal) * 100));

  const streak = (() => {
    if (!history || history.length === 0) return 0;
    const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
    let expected = sorted[0].date;
    let count = 0;
    for (const log of sorted) {
      if (log.date === expected) {
        count++;
        const d = new Date(expected);
        d.setDate(d.getDate() - 1);
        expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      } else if (log.date > expected) {
        continue;
      } else {
        break;
      }
    }
    return count;
  })();

  const handleSessionEnd = useCallback(async (reps: number) => {
    if (user && reps > 0) {
      await logSession({ userId: user._id, sessionReps: reps });
    }
  }, [user, logSession]);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === "battles") {
      if (!user) {
        // Need to be signed in for battles
        window.location.href = "/auth";
        return;
      }
      if (!user.username) {
        setShowUsernamePrompt(true);
        return;
      }
    }
    setTab(newTab);
  };

  const tabs: { id: Tab; icon: typeof Camera; label: string }[] = [
    { id: "counter", icon: Camera, label: "Count" },
    { id: "battles", icon: Swords, label: "Head-to-Head" },
    { id: "leaderboard", icon: Trophy, label: "Leaderboard" },
  ];

  const userId = user?._id ?? "";
  const username = user?.username ?? "";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Username prompt overlay */}
      {showUsernamePrompt && user && (
        <UsernamePrompt
          userId={user._id}
          onDone={() => { setShowUsernamePrompt(false); setTab("battles"); }}
        />
      )}

      {/* Header */}
      <header className="clay-card rounded-t-none border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Situp Challenge</h1>
            <p className="text-xs text-muted-foreground">{user?.username ?? user?.name ?? "Guest"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="clay-button w-9 h-9"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {user && (
              <Button
                variant="ghost"
                size="sm"
                className="clay-button text-xs"
                onClick={signOut}
              >
                Sign Out
              </Button>
            )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {tab === "counter" && (
          <div>
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 p-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="clay-card p-3 flex flex-col items-center gap-1"
              >
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-xl font-bold">{dailyCount}</span>
                <span className="text-[11px] text-muted-foreground">Today</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="clay-card p-3 flex flex-col items-center gap-1"
              >
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-xl font-bold">{streak}</span>
                <span className="text-[11px] text-muted-foreground">Streak</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="clay-card p-3 flex flex-col items-center gap-1"
              >
                <Target className="w-5 h-5 text-primary" />
                <span className="text-xl font-bold">{goalProgress}%</span>
                <span className="text-[11px] text-muted-foreground">Goal</span>
              </motion.div>
            </div>

            {/* Hero */}
            <div className="px-4 pb-4">
              <div className="clay-pill bg-primary/10 text-primary text-xs flex items-center gap-1.5 w-fit mx-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Camera-Powered Rep Tracking
              </div>
            </div>

            <div className="text-center px-6 pb-5">
              <h2 className="text-3xl font-bold leading-tight">
                Count situps
                <br />
                <span className="text-primary">with precision.</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto leading-relaxed">
                Point your front camera, start a session, and let pose detection
                count every rep. Compete on the leaderboard or challenge someone
                to a head-to-head battle.
              </p>
            </div>

            {/* Animated mockup */}
            <div className="px-6 pb-5">
              <div className="clay-card p-6 flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-3 right-3 clay-pill bg-muted text-xs px-2 py-0.5">
                  +1 rep
                </div>
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Trophy className="w-10 h-10 text-primary" />
                </div>
                <span className="text-2xl font-bold">{dailyCount} reps</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {dailyCount === 0 ? "Start counting" : "Keep going"}
                </span>
                <div className="absolute bottom-3 left-3 clay-pill bg-muted text-xs px-2 py-0.5">
                  Goal: {dailyGoal}
                </div>
              </div>
            </div>

            {/* Camera Counter */}
            <div className="px-4">
              <CameraCounter
                onSessionEnd={handleSessionEnd}
              />
            </div>
          </div>
        )}

        {tab === "battles" && user && user.username && (
          <div className="p-4">
            <BattleSystem
              onBack={() => {
                setTab("counter");
                setSearchParams({});
              }}
              initialBattleCode={searchParams.get("battle") ?? undefined}
              userId={userId}
              username={username}
            />
          </div>
        )}

        {tab === "leaderboard" && <LeaderboardSection />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 clay-card rounded-b-none border-t border-border z-50">
        <div className="grid grid-cols-3">
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex flex-col items-center gap-1 py-3 transition-colors ${
                tab === id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function LeaderboardSection() {
  const rankings = useQuery(api.situpLogs.getLeaderboard);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Today's Rankings</h2>
      {!rankings ? (
        <div className="clay-card p-8 text-center">
          <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading rankings...</p>
        </div>
      ) : rankings.length === 0 ? (
        <div className="clay-card p-8 text-center">
          <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No sessions logged today. Be the first!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rankings.map((entry, i) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="clay-card px-4 py-3 flex items-center gap-3"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i === 0
                    ? "bg-yellow-500/20 text-yellow-400"
                    : i === 1
                      ? "bg-gray-300/20 text-gray-300"
                      : i === 2
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entry.userName}</p>
              </div>
              <span className="text-sm font-bold text-primary">
                {entry.total}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
