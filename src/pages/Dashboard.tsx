import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/ThemeProvider";
import { CameraCounter } from "@/components/CameraCounter";
import { BattleSystem } from "@/components/BattleSystem";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  LogOut,
  Swords,
  Camera,
  Target,
  Flame,
  TrendingUp,
  Shield,
  Medal,
  Home,
  Trophy,
} from "lucide-react";

type Tab = "home" | "counter" | "battles" | "leaderboard";

const navItems: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "counter", label: "Count", icon: Camera },
  { id: "battles", label: "Head-to-Head", icon: Swords },
  { id: "leaderboard", label: "Leaderboard", icon: Medal },
];



export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const userId = user?._id ?? "";

  const [tab, setTab] = useState<Tab>(() => {
    if (searchParams.get("battle")) return "battles";
    return "home";
  });

  const logSession = useMutation(api.situpLogs.logSession);
  const todayCount = useQuery(
    api.situpLogs.getTodayCount,
    userId ? { userId } : "skip"
  );
  const history = useQuery(
    api.situpLogs.getHistory,
    userId ? { userId } : "skip"
  );
  const leaderboard = useQuery(api.situpLogs.getLeaderboard);

  const handleSessionEnd = useCallback(
    async (reps: number) => {
      if (reps > 0 && userId) {
        await logSession({ userId, sessionReps: reps });
      }
    },
    [userId, logSession]
  );

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  const streak = (() => {
    if (!history || history.length === 0) return 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < history.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const y = expected.getFullYear();
      const m = String(expected.getMonth() + 1).padStart(2, "0");
      const d = String(expected.getDate()).padStart(2, "0");
      const expectedStr = `${y}-${m}-${d}`;
      if (history[i]?.date === expectedStr && history[i].count > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  })();

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--primary)] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-foreground leading-none">
                Situp Challenge
              </h1>
              <p className="text-xs text-muted-foreground">
                {user?.name || "Guest"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleTheme}
              className="clay-btn w-10 h-10 p-0"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </Button>
            {userId && (
              <Button
                onClick={handleSignOut}
                className="clay-btn w-10 h-10 p-0"
                style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* ── Home Tab ── */}
        {tab === "home" && (
          <div className="flex flex-col gap-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="clay-card p-4 text-center">
                <Flame className="w-5 h-5 text-[var(--primary)] mx-auto mb-1" />
                <p className="text-2xl font-black text-foreground">
                  {todayCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
              <div className="clay-card p-4 text-center">
                <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-foreground">{streak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
              <div className="clay-card p-4 text-center">
                <Target className="w-5 h-5 text-[var(--accent)] mx-auto mb-1" />
                <p className="text-2xl font-black text-foreground">100</p>
                <p className="text-xs text-muted-foreground">Daily Goal</p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTab("counter")}
                className="clay-card p-5 text-left group hover:shadow-lg transition-shadow"
              >
                <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <h4 className="text-sm font-bold text-foreground mb-1">Start Counting</h4>
                <p className="text-xs text-muted-foreground">Open camera and count reps</p>
              </button>
              <button
                onClick={() => setTab("battles")}
                className="clay-card p-5 text-left group hover:shadow-lg transition-shadow"
              >
                <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Swords className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <h4 className="text-sm font-bold text-foreground mb-1">Head-to-Head</h4>
                <p className="text-xs text-muted-foreground">Challenge someone to a battle</p>
              </button>
              <button
                onClick={() => setTab("leaderboard")}
                className="clay-card p-5 text-left group hover:shadow-lg transition-shadow"
              >
                <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Medal className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <h4 className="text-sm font-bold text-foreground mb-1">Leaderboard</h4>
                <p className="text-xs text-muted-foreground">See today&apos;s rankings</p>
              </button>
              <div className="clay-card p-5">
                <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--primary)]/10 flex items-center justify-center mb-3">
                  <Trophy className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <h4 className="text-sm font-bold text-foreground mb-1">Daily Goal</h4>
                <p className="text-xs text-muted-foreground">Target: 100 reps per day</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Counter Tab ── */}
        {tab === "counter" && (
          <>
            {/* Hero */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-6"
            >
              <div className="inline-flex items-center gap-2 clay-card px-4 py-2 mb-5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-muted-foreground">
                  Camera-Powered Rep Tracking
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-foreground leading-tight mb-3">
                Count situps
                <br />
                <span className="text-[var(--primary)]">with precision.</span>
              </h2>

              <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6 leading-relaxed">
                Point your front camera, start a session, and let pose detection
                count every rep. Compete on the leaderboard or challenge someone
                to a head-to-head battle.
              </p>

              {/* Hero mockup */}
              <div className="clay-card-lg p-4 max-w-sm mx-auto mb-6">
                <div className="aspect-[4/3] rounded-[var(--clay-radius)] bg-gradient-to-br from-[var(--primary)]/15 via-[var(--secondary)]/10 to-[var(--accent)]/15 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="clay-counter w-24 h-24 text-4xl font-black mb-3 animate-bounce">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <p className="text-xl font-bold text-foreground">0 reps</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start counting
                  </p>
                  <motion.div
                    animate={{ y: [-4, 4, -4] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute top-3 right-3 clay-pill bg-[var(--accent)]/25 px-2 py-0.5"
                  >
                    <span className="text-[10px] font-medium text-foreground">
                      +1 rep
                    </span>
                  </motion.div>
                  <motion.div
                    animate={{ y: [4, -4, 4] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    className="absolute bottom-4 left-3 clay-pill bg-[var(--primary)]/15 px-2 py-0.5"
                  >
                    <span className="text-[10px] font-medium text-foreground">
                      Goal: 100
                    </span>
                  </motion.div>
                </div>
              </div>
            </motion.section>

            <CameraCounter onSessionEnd={handleSessionEnd} dailyGoal={100} />
          </>
        )}

        {/* ── Battle Tab ── */}
        {tab === "battles" && (
          <BattleSystem onBack={() => setTab("home")} />
        )}

        {/* ── Leaderboard Tab ── */}
        {tab === "leaderboard" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-foreground">
              Today&apos;s Leaderboard
            </h2>
            {!leaderboard || leaderboard.length === 0 ? (
              <div className="clay-card p-8 text-center">
                <Medal className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">
                  No sessions logged today. Be the first.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {leaderboard.map((entry, i) => {
                  const isMe = entry.userId === userId;
                  const rankBadge =
                    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                  return (
                    <div
                      key={entry.userId}
                      className={`clay-card p-4 flex items-center gap-4 ${
                        isMe ? "ring-2 ring-[var(--primary)]/50" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--muted)] flex items-center justify-center text-lg font-bold text-foreground shrink-0">
                        {typeof rankBadge === "string" &&
                        rankBadge.startsWith("#") ? (
                          <span className="text-sm">{rankBadge}</span>
                        ) : (
                          rankBadge
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {entry.userName}
                          {isMe && (
                            <span className="text-xs text-[var(--primary)] ml-2">
                              (you)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-foreground">
                          {entry.total}
                        </p>
                        <p className="text-xs text-muted-foreground">reps</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-t border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex">
          {navItems.map((item) => {
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                  isActive
                    ? "text-[var(--primary)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
