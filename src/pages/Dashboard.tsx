import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import { CameraCounter } from "@/components/CameraCounter";
import { BattleSystem } from "@/components/BattleSystem";

type Tab = "counter" | "battles" | "leaderboard";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    return searchParams.get("battle") ? "battles" as Tab : "counter";
  });
  const setUsernameMutation = useMutation(api.username.setUsername);
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

  // Save pending username — retries every render until Convex confirms it's saved
  useEffect(() => {
    if (user && !user.username) {
      const pending = localStorage.getItem("situp-pending-username");
      if (pending) {
        setUsernameMutation({ userId: user._id, username: pending })
          .then(() => {
            localStorage.removeItem("situp-pending-username");
          })
          .catch(() => {
            // Will retry on next render — username persists in localStorage until save succeeds
          });
      }
    }
  }, [user, setUsernameMutation]);

  // Display name: prefer Convex DB username, then localStorage, then name, then Guest
  const displayName = user?.username || localStorage.getItem("situp-pending-username") || user?.name || "Guest";

  const handleTabChange = (newTab: Tab) => {
    if (newTab === "battles" && !user) {
      window.location.href = "/auth";
      return;
    }
    setTab(newTab);
  };

  const tabs: { id: Tab; icon: typeof Camera; label: string }[] = [
    { id: "counter", icon: Camera, label: "Count" },
    { id: "battles", icon: Swords, label: "Head-to-Head" },
    { id: "leaderboard", icon: Trophy, label: "Leaderboard" },
  ];

  const userId = user?._id ?? "";
  const username = user?.username || localStorage.getItem("situp-pending-username") || "";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="clay-card rounded-t-none border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Situp Challenge</h1>
            <p className="text-xs text-muted-foreground">{displayName}</p>
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

        {tab === "battles" && user && (
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
