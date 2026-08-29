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

// Set username — tries auth context first, falls back to userId lookup
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

    // Check if username is taken by someone else
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();
    if (existing && existing._id !== args.userId) {
      throw new Error("Username is already taken");
    }

    // Try to find the user document by querying the users table
    const allUsers = await ctx.db.query("users").collect();
    const userDoc = allUsers.find((u) => u._id === args.userId);

    if (userDoc) {
      await ctx.db.patch(userDoc._id, { username: normalized });
      return normalized;
    }

    // Last resort: find any anonymous user without a username and set it
    const anonUser = allUsers.find((u) => u.isAnonymous && !u.username);
    if (anonUser) {
      await ctx.db.patch(anonUser._id, { username: normalized });
      return normalized;
    }

    throw new Error("Could not find user account to save username");
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
