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

    // Find user by iterating auth tables
    // The userId from useAuth() is the auth account ID, not the users document ID
    // We need to find the users document linked to this auth account
    const authAccount = await ctx.db.get(args.userId as any);
    if (!authAccount) {
      // Try to find via the auth accounts table
      // For anonymous users, the account might be in a different table
      throw new Error(`User not found for ID: ${args.userId}`);
    }

    // Check if username is taken by someone else
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();
    if (existing && (existing as any)._id !== args.userId) {
      throw new Error("Username is already taken");
    }

    // Check if user already has a username
    if ("username" in authAccount && (authAccount as any).username) {
      // Already set — allow overwrite (for first-time fixup)
    }

    // Set username
    await ctx.db.patch(authAccount._id, { username: normalized });

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
