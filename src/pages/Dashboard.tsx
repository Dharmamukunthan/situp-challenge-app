import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/ThemeProvider";
import { CameraCounter } from "@/components/CameraCounter";
import { BattleSystem } from "@/components/BattleSystem";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router";
import {
  Sun,
  Moon,
  LogOut,
  Swords,
  Camera,
  BarChart3,
  ChevronLeft,
  Target,
  Flame,
  TrendingUp,
} from "lucide-react";

type Tab = "counter" | "battles" | "history";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const userId = user?._id ?? "";

  const [tab, setTab] = useState<Tab>(() => {
    if (searchParams.get("battle")) return "battles";
    return "counter";
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
      const expectedStr = expected.toISOString().split("T")[0];
      if (history[i]?.date === expectedStr && history[i].count > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  })();

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--primary)] flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-foreground leading-none">SitUp Counter</h1>
              <p className="text-xs text-muted-foreground">
                {user?.name || "Athlete"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleTheme}
              className="clay-btn w-10 h-10 p-0"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleSignOut}
              className="clay-btn w-10 h-10 p-0"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="clay-card p-4 text-center">
            <Flame className="w-5 h-5 text-[var(--primary)] mx-auto mb-1" />
            <p className="text-2xl font-black text-foreground">{todayCount ?? 0}</p>
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

        {/* Tab bar */}
        <div className="clay-inset p-1 flex gap-1 mb-6">
          {[
            { id: "counter" as Tab, label: "Count", icon: Camera },
            { id: "battles" as Tab, label: "Battle", icon: Swords },
            { id: "history" as Tab, label: "History", icon: BarChart3 },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[var(--clay-radius)] font-medium text-sm transition-all ${
                tab === t.id
                  ? "bg-background shadow-md text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "counter" && (
          <CameraCounter onSessionEnd={handleSessionEnd} dailyGoal={100} />
        )}

        {tab === "battles" && (
          <BattleSystem onBack={() => setTab("counter")} />
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
            {!history || history.length === 0 ? (
              <div className="clay-card p-8 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No history yet. Start counting!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((day) => {
                  const pct = Math.min((day.count / 100) * 100, 100);
                  return (
                    <div key={day.date} className="clay-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">
                          {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="text-sm font-bold text-[var(--primary)]">
                          {day.count} reps
                        </span>
                      </div>
                      <div className="w-full h-2 clay-inset overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background:
                              day.count >= 100
                                ? "linear-gradient(135deg, #b5e8d5, #5ecfb5)"
                                : "linear-gradient(135deg, #f4845f, #f8c8dc)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
