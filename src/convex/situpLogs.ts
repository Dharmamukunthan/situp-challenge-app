import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getTodayLogs = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
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
    const today = new Date().toISOString().split("T")[0];
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
    const today = new Date().toISOString().split("T")[0];
    await ctx.db.insert("situpLogs", {
      userId: args.userId,
      date: today,
      count: args.sessionReps,
      sessionReps: args.sessionReps,
    });
    return args.sessionReps;
  },
});
