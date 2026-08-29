import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Check if a username is already taken
export const checkUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.username.trim().toLowerCase();
    if (normalized.length < 2 || normalized.length > 16) {
      return { valid: false, error: "Username must be 2-16 characters" };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
      return { valid: false, error: "Only letters, numbers, and underscores allowed" };
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();
    if (existing) {
      return { valid: false, error: "Username is already taken" };
    }
    return { valid: true, error: null };
  },
});

// Set username for current user (one-time, cannot change)
export const setUsername = mutation({
  args: {
    userId: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = args.username.trim().toLowerCase();

    if (normalized.length < 2 || normalized.length > 16) {
      throw new Error("Username must be 2-16 characters");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
      throw new Error("Only letters, numbers, and underscores allowed");
    }

    // Check if username is taken
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();
    if (existing) {
      throw new Error("Username is already taken");
    }

    // Check if user already has a username (can't change)
    const user = await ctx.db.get(args.userId as any);
    if (user && "username" in user && (user as any).username) {
      throw new Error("Username already set and cannot be changed");
    }

    // Set username
    if (user) {
      await ctx.db.patch(user._id, { username: normalized });
    }

    return normalized;
  },
});

// Get username by userId
export const getUsername = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId as any);
    if (user && "username" in user) {
      return (user as any).username || null;
    }
    return null;
  },
});
