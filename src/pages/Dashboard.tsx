import { useState, useCallback } from "react";
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
  Target,
  Flame,
  TrendingUp,
  Shield,
  Medal,
  Send,
} from "lucide-react";

type Tab = "counter" | "battles" | "leaderboard" | "feed";

const navItems: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: "counter", label: "Count", icon: Camera },
  { id: "battles", label: "Battle", icon: Swords },
  { id: "leaderboard", label: "Ranks", icon: Medal },
  { id: "feed", label: "Feed", icon: BarChart3 },
];

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
  const createPost = useMutation(api.posts.createPost);
  const todayCount = useQuery(
    api.situpLogs.getTodayCount,
    userId ? { userId } : "skip"
  );
  const history = useQuery(
    api.situpLogs.getHistory,
    userId ? { userId } : "skip"
  );
  const leaderboard = useQuery(api.situpLogs.getLeaderboard);
  const posts = useQuery(api.posts.getRecentPosts);

  const [postContent, setPostContent] = useState("");
  const [postSent, setPostSent] = useState(false);

  const handleSessionEnd = useCallback(
    async (reps: number) => {
      if (reps > 0 && userId) {
        await logSession({ userId, sessionReps: reps });
      }
    },
    [userId, logSession]
  );

  const handlePost = useCallback(async () => {
    if (!postContent.trim() || !userId) return;
    await createPost({
      userId,
      userName: user?.name || "Athlete",
      content: postContent.trim(),
      reps: todayCount ?? 0,
    });
    setPostContent("");
    setPostSent(true);
    setTimeout(() => setPostSent(false), 2000);
  }, [postContent, userId, user?.name, todayCount, createPost]);

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
              <h1 className="font-bold text-foreground leading-none">Situp Challenge</h1>
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
        {/* Stats row — only on counter tab */}
        {tab === "counter" && (
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
        )}

        {/* Tab content */}
        {tab === "counter" && (
          <CameraCounter onSessionEnd={handleSessionEnd} dailyGoal={100} />
        )}

        {tab === "battles" && (
          <BattleSystem onBack={() => setTab("counter")} />
        )}

        {tab === "leaderboard" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-foreground">Today&apos;s Leaderboard</h2>
            {!leaderboard || leaderboard.length === 0 ? (
              <div className="clay-card p-8 text-center">
                <Medal className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No sessions logged today. Be the first.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {leaderboard.map((entry, i) => {
                  const isMe = entry.userId === userId;
                  const rankBadge = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                  return (
                    <div
                      key={entry.userId}
                      className={`clay-card p-4 flex items-center gap-4 ${
                        isMe ? "ring-2 ring-[var(--primary)]/50" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-[var(--clay-radius)] bg-[var(--muted)] flex items-center justify-center text-lg font-bold text-foreground shrink-0">
                        {typeof rankBadge === "string" && rankBadge.startsWith("#") ? (
                          <span className="text-sm">{rankBadge}</span>
                        ) : (
                          rankBadge
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {entry.userName}
                          {isMe && <span className="text-xs text-[var(--primary)] ml-2">(you)</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-foreground">{entry.total}</p>
                        <p className="text-xs text-muted-foreground">reps</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "feed" && (
          <div className="flex flex-col gap-4">
            {/* Post composer */}
            <div className="clay-card p-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Share your progress..."
                    rows={2}
                    className="w-full resize-none rounded-[var(--clay-radius)] bg-[var(--muted)] border border-[var(--border)] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  {todayCount ?? 0} reps today
                </p>
                <Button
                  onClick={handlePost}
                  disabled={!postContent.trim()}
                  className="clay-btn h-9 px-4 text-sm"
                >
                  <Send className="w-4 h-4 mr-1" />
                  {postSent ? "Posted!" : "Post"}
                </Button>
              </div>
            </div>

            {/* Feed */}
            {!posts || posts.length === 0 ? (
              <div className="clay-card p-8 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No posts yet. Share your first update.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {posts.map((post) => (
                  <div key={post._id} className="clay-card p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center text-xs font-bold text-[var(--primary)]">
                        {post.userName?.charAt(0)?.toUpperCase() || "A"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{post.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {post.reps != null && ` · ${post.reps} reps`}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{post.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* History */}
            {history && history.length > 0 && (
              <>
                <h3 className="text-lg font-bold text-foreground mt-4">Session History</h3>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
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
