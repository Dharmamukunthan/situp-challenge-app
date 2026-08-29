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

export const createBattle = mutation({
  args: {
    creatorId: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const code = generateCode();
    const id = await ctx.db.insert("battles", {
      creatorId: args.creatorId,
      duration: args.duration,
      creatorScore: 0,
      opponentScore: 0,
      status: "waiting",
      battleCode: code,
      matchType: "private",
    });
    return { id, code };
  },
});

export const joinBattle = mutation({
  args: {
    battleCode: v.string(),
    opponentId: v.string(),
  },
  handler: async (ctx, args) => {
    const battle = await ctx.db
      .query("battles")
      .withIndex("by_code", (q) => q.eq("battleCode", args.battleCode))
      .first();
    if (!battle) throw new Error("Battle not found");
    if (battle.status !== "waiting") throw new Error("Battle already started");
    if (battle.creatorId === args.opponentId) throw new Error("Cannot join your own battle");

    const now = Date.now();
    await ctx.db.patch(battle._id, {
      opponentId: args.opponentId,
      status: "active",
      startedAt: now,
    });
    return battle._id;
  },
});

export const updateScore = mutation({
  args: {
    battleId: v.id("battles"),
    userId: v.string(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    const battle = await ctx.db.get(args.battleId);
    if (!battle) throw new Error("Battle not found");
    if (battle.status !== "active") return;

    const now = Date.now();
    const elapsed = battle.startedAt ? (now - battle.startedAt) / 1000 : 0;

    if (elapsed >= battle.duration) {
      await ctx.db.patch(args.battleId, {
        status: "finished",
        endedAt: now,
      });
      return;
    }

    if (args.userId === battle.creatorId) {
      await ctx.db.patch(args.battleId, { creatorScore: args.score });
    } else if (args.userId === battle.opponentId) {
      await ctx.db.patch(args.battleId, { opponentScore: args.score });
    }
  },
});

export const endBattle = mutation({
  args: {
    battleId: v.id("battles"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.battleId, {
      status: "finished",
      endedAt: Date.now(),
    });
  },
});

export const getBattle = query({
  args: { battleId: v.id("battles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.battleId);
  },
});

export const getBattleByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("battles")
      .withIndex("by_code", (q) => q.eq("battleCode", args.code))
      .first();
  },
});

export const getUserBattles = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const created = await ctx.db
      .query("battles")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.userId))
      .order("desc")
      .collect();
    const joined = await ctx.db
      .query("battles")
      .withIndex("by_opponent", (q) => q.eq("opponentId", args.userId))
      .order("desc")
      .collect();
    const all = [...created, ...joined];
    const seen = new Set<string>();
    return all.filter((b) => {
      if (seen.has(b._id)) return false;
      seen.add(b._id);
      return true;
    });
  },
});
