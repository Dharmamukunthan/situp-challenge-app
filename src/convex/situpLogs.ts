import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function getLocalDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const getTodayLogs = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const today = getLocalDateStr();
    return await ctx.db
      .query("situpLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", today)
      )
      .collect();
  },
});

export const getTodayCount = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const today = getLocalDateStr();
    const logs = await ctx.db
      .query("situpLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", today)
      )
      .collect();
    return logs.reduce((sum, log) => sum + log.sessionReps, 0);
  },
});

export const getHistory = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("situpLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    // Group by date and sum reps
    const byDate: Record<string, number> = {};
    for (const log of logs) {
      byDate[log.date] = (byDate[log.date] || 0) + log.sessionReps;
    }
    return Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .slice(0, 30);
  },
});

export const logSession = mutation({
  args: {
    userId: v.string(),
    sessionReps: v.number(),
  },
  handler: async (ctx, args) => {
    const today = getLocalDateStr();
    await ctx.db.insert("situpLogs", {
      userId: args.userId,
      date: today,
      count: args.sessionReps,
      sessionReps: args.sessionReps,
    });
    return args.sessionReps;
  },
});

export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const today = getLocalDateStr();
    const todayLogs = await ctx.db
      .query("situpLogs")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    const byUser: Record<string, { userId: string; total: number }> = {};
    for (const log of todayLogs) {
      if (!byUser[log.userId]) byUser[log.userId] = { userId: log.userId, total: 0 };
      byUser[log.userId].total += log.sessionReps;
    }

    const entries = Object.values(byUser);
    const results: { userId: string; userName: string; total: number }[] = [];
    for (const entry of entries.slice(0, 20)) {
      let userName = "Athlete";
      try {
        const userDoc = await ctx.db.get(entry.userId as any);
        if (userDoc) {
          userName = (userDoc as any).username || (userDoc as any).name || "Athlete";
        }
      } catch {
        // ignore
      }
      results.push({ userId: entry.userId, userName, total: entry.total });
    }

    return results.sort((a, b) => b.total - a.total);
  },
});
