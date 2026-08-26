import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const createPost = mutation({
  args: {
    userId: v.string(),
    userName: v.string(),
    content: v.string(),
    reps: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("posts", {
      userId: args.userId,
      userName: args.userName,
      content: args.content,
      reps: args.reps,
      createdAt: Date.now(),
    });
  },
});

export const getRecentPosts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("posts")
      .withIndex("by_time")
      .order("desc")
      .take(50);
  },
});
