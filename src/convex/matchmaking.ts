import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Try to find a match. If an opponent is waiting with the same duration, pair them.
// Otherwise, add this player to the waiting queue.
export const findMatch = mutation({
  args: {
    userId: v.string(),
    username: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if already in queue
    const existing = await ctx.db
      .query("matchmaking")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing && existing.status === "waiting") {
      // Already waiting — try to match again
      const opponent = await ctx.db
        .query("matchmaking")
        .withIndex("by_status_duration", (q) =>
          q.eq("status", "waiting").eq("duration", args.duration)
        )
        .filter((q) => q.neq(q.field("userId"), args.userId))
        .order("asc")
        .first();

      if (opponent) {
        // Found a match — create battle
        const code = generateCode();
        const battleId = await ctx.db.insert("battles", {
          creatorId: opponent.userId,
          opponentId: args.userId,
          duration: args.duration,
          creatorScore: 0,
          opponentScore: 0,
          status: "active",
          startedAt: Date.now(),
          battleCode: code,
          matchType: "random",
        });

        // Update both matchmaking entries
        await ctx.db.patch(opponent._id, {
          status: "matched",
          battleId: battleId as any,
        });
        await ctx.db.patch(existing._id, {
          status: "matched",
          battleId: battleId as any,
        });

        return battleId;
      }

      // Still waiting
      return null;
    }

    // Remove any old matchmaking entries for this user
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Look for a waiting opponent with the same duration
    const opponent = await ctx.db
      .query("matchmaking")
      .withIndex("by_status_duration", (q) =>
        q.eq("status", "waiting").eq("duration", args.duration)
      )
      .filter((q) => q.neq(q.field("userId"), args.userId))
      .order("asc")
      .first();

    if (opponent) {
      // Found a match — create battle
      const code = generateCode();
      const battleId = await ctx.db.insert("battles", {
        creatorId: opponent.userId,
        opponentId: args.userId,
        duration: args.duration,
        creatorScore: 0,
        opponentScore: 0,
        status: "active",
        startedAt: Date.now(),
        battleCode: code,
        matchType: "random",
      });

      await ctx.db.patch(opponent._id, {
        status: "matched",
        battleId: battleId as any,
      });

      // Add this player as matched too
      await ctx.db.insert("matchmaking", {
        userId: args.userId,
        username: args.username,
        duration: args.duration,
        status: "matched",
        createdAt: Date.now(),
        battleId: battleId as any,
      });

      return battleId;
    }

    // No one waiting — add to queue
    await ctx.db.insert("matchmaking", {
      userId: args.userId,
      username: args.username,
      duration: args.duration,
      status: "waiting",
      createdAt: Date.now(),
    });

    return null;
  },
});

// Check if we've been matched (poll this every 2s)
export const getMyMatch = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("matchmaking")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!entry) return null;
    if (entry.status === "matched" && entry.battleId) {
      return { battleId: entry.battleId };
    }
    return null;
  },
});

// Cancel matchmaking — remove from queue
export const cancelMatch = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("matchmaking")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (entry && entry.status === "waiting") {
      await ctx.db.delete(entry._id);
    }
  },
});

// Get current queue position / status
export const getMatchStatus = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("matchmaking")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!entry) return null;
    return { status: entry.status, battleId: entry.battleId };
  },
});
