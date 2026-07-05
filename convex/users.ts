import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * users.ts.
 *
 * The single source of truth for resolving the Clerk identity
 * to a Convex `users` row. Every backend module used to ship
 * its own copy of `resolveUser` / `requireUser`. Those copies
 * were strictly read-only: they returned `null` (queries) or
 * threw (mutations) if the users row was missing.
 *
 * That contract was the root cause of a "cannot enroll on a
 * fresh sign-up" bug: Clerk writes the identity to its JWT,
 * but nothing was creating a `users` row in Convex. Every
 * authenticated mutation therefore threw `Unauthenticated`.
 *
 * The fix is two-pronged:
 *
 *  1. **Lazy-create on mutations.** `resolveOrCreateUser` /
 *     `requireUser` (now imported from this module) insert the
 *     row inline if it is missing. The first authenticated
 *     mutation from a brand-new user self-heals the missing
 *     row, even before the Clerk webhook has fired.
 *
 *  2. **Clerk webhook.** `upsertFromClerk` is a public mutation
 *     guarded by a shared secret (`process.env.CONVEX_WEBHOOK_SECRET`).
 *     The Next.js Route Handler at
 *     `app/api/webhooks/clerk/route.ts` verifies the svix
 *     signature on incoming Clerk events, then calls this
 *     mutation with the matching secret. Webhook writes are
 *     always preferred to lazy-create because they carry the
 *     real email and display name from Clerk.
 *
 * Race semantics: Convex serializes mutations on a single
 * deployment. Two mutations racing on the same `(clerkId)` —
 * e.g. the webhook firing while the user clicks "Add subject"
 * — both call `ctx.db.query(...).first()` against the
 * `by_clerk_id` index. The second one will see the first one's
 * row and return it instead of inserting. There is no path by
 * which two `users` rows end up with the same `clerkId`.
 */

/**
 * resolveUserReadOnly.
 *
 * Safe for use inside `query` handlers (read-only ctx). Returns
 * the user row for the current Clerk identity, or `null` if the
 * identity is not present OR if the row has not been created
 * yet. Does NOT write to the database.
 *
 * Callers that need to distinguish "no Clerk identity" from
 * "Clerk identity, no Convex row" should use
 * `resolveIdentityAndUser` instead — it exposes both fields.
 */
export async function resolveUserReadOnly(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const resolved = await resolveIdentityAndUser(ctx);
  if (!resolved) return null;
  return resolved.user;
}

/**
 * getMe.
 *
 * The minimal identity query required by client components
 * that need the calling user's `users._id` to pass to owner-
 * scoped queries (e.g. `api.topics.listUserTopicsByOwner`).
 * The Clerk JWT propagates via the convex client; the query
 * surfaces `null` for unauthenticated callers so callers can
 * cleanly gate their `useQuery` calls.
 *
 * Optional surface — only the `_id`, `name`, `email`,
 * `role` are exposed for backwards compatibility with the
 * older `dashboard.getOverview` user shape.
 */
export const getMe = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.union(v.string(), v.null()),
      email: v.string(),
      role: v.union(
        v.literal("Student"),
        v.literal("ParentObserver"),
        v.literal("Tutor"),
        v.literal("Admin")
      ),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const user = await resolveUserReadOnly(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email,
      role: user.role,
    };
  },
});

/**
 * getOnboardingStatus.
 *
 * Returns the `onboardingComplete` flag for the current
 * user (or `false` when there is no Clerk identity or no
 * users row yet — every fresh sign-up or anonymous identity
 * counts as "not yet onboarded" until the flow finishes).
 *
 * The `(app)/layout.tsx` server gate uses this query to
 * decide whether to redirect into `/onboarding` (not
 * complete) or out of `/onboarding` (already complete).
 */
export const getOnboardingStatus = query({
  args: {},
  returns: v.object({
    signedIn: v.boolean(),
    onboardingComplete: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { signedIn: false, onboardingComplete: false };
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return { signedIn: true, onboardingComplete: false };
    return {
      signedIn: true,
      onboardingComplete: user.onboardingComplete === true,
    };
  },
});

/**
 * resolveIdentityAndUser.
 *
 * The single read-side primitive for "who is calling?". Returns
 * the Clerk identity AND the Convex `users` row independently,
 * because callers often need to distinguish:
 *
 *   1. no Clerk identity       → caller is unauthenticated,
 *      branch to the gate path.
 *   2. Clerk identity, no row  → caller is signed in but the
 *      webhook / lazy-create has not landed yet. The catalog
 *      must still render (this is the dev-time default); any
 *      mutation will lazy-create the row downstream.
 *   3. Clerk identity + row    → the happy path.
 *
 * Read-only. Never inserts.
 */
export async function resolveIdentityAndUser(
  ctx: QueryCtx | MutationCtx
): Promise<
  | { identity: { subject: string; email?: string | null; name?: string | null }; user: Doc<"users"> | null }
  | null
> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  return { identity, user };
}

/**
 * Internal helper. If the Clerk identity is present but the
 * users row is missing, insert it with the minimal shape the
 * schema requires. The webhook lands later and patches
 * `email` / `name` to the authoritative Clerk values.
 *
 * Throws "Unauthenticated" if there is no Clerk identity at
 * all — i.e. the caller is not signed in. Without this guard
 * we would silently insert `users` rows that are not anchored
 * to any Clerk session, which would break every other backend
 * invariant.
 */
async function resolveOrCreateInternal(
  ctx: MutationCtx
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (existing) return existing;

  // Identity claims are not guaranteed to include email/name.
  // Empty-string email is a safe default because the schema
  // requires `email: v.string()`. The webhook patches it to
  // the real value as soon as it fires.
  const identityAny = identity as {
    email?: string | null;
    name?: string | null;
  };
  // `ctx.db.insert` returns only the new row's `Id<"users">`,
  // not a fully-shaped `Doc`. We `get` it back so the function
  // contract returns the full `Doc<"users">` shape that all
  // callers rely on (including `_creationTime`, which is useful
  // for telemetry bumps downstream).
  const insertedId = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email: typeof identityAny.email === "string" ? identityAny.email : "",
    name:
      typeof identityAny.name === "string" && identityAny.name.length > 0
        ? identityAny.name
        : undefined,
    role: "Student",
  });
  const inserted = await ctx.db.get(insertedId);
  // `ctx.db.get` returns `null` only if the row was deleted
  // concurrently, which cannot happen inside a serialized
  // mutation. Treat null as a programmer error.
  if (!inserted) throw new Error("Inserted user row missing");
  return inserted;
}

/**
 * resolveOrCreateUser.
 *
 * Mutation-context helper. Returns the user row, creating it
 * if missing. Never returns null; never throws for an
 * authenticated mutation context. Use this when you want
 * "give me the user, and I don't care if they were synced yet".
 */
export async function resolveOrCreateUser(
  ctx: MutationCtx
): Promise<Doc<"users">> {
  return await resolveOrCreateInternal(ctx);
}

/**
 * requireUser.
 *
 * Mutation-context helper. Throws if there is no Clerk
 * identity; resolves (creating if needed) if the identity is
 * present. This is the drop-in replacement for the throw-on-
 * missing `requireUser` previously inlined in every backend
 * module.
 */
export async function requireUser(
  ctx: MutationCtx
): Promise<Doc<"users">> {
  return await resolveOrCreateInternal(ctx);
}

/**
 * Read the shared webhook secret at call time so a
 * misconfigured deployment fails on the first webhook attempt
 * instead of bundling a constant. Returns `null` if the env
 * var is not set, which lets the mutation refuse the call.
 */
function readWebhookSecret(): string | null {
  const s = process.env.CONVEX_WEBHOOK_SECRET;
  if (!s || s.length === 0) return null;
  return s;
}

/**
 * upsertFromClerk.
 *
 * Public mutation called by the Clerk webhook handler at
 * `app/api/webhooks/clerk/route.ts`. The svix signature on
 * the incoming request is verified by the Route Handler
 * before this mutation is invoked; THIS mutation validates
 * the shared `secret` argument against
 * `process.env.CONVEX_WEBHOOK_SECRET`, so even if the
 * signature were spoofed someone would still need to know
 * that secret to write a `users` row.
 *
 * Idempotent: looks up by `clerkId` first and patches the
 * existing row's `email` / `name` rather than always
 * inserting. Safe under mutation serialization (see file
 * header).
 */
export const upsertFromClerk = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.union(v.string(), v.null()),
    secret: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, { clerkId, email, name, secret }) => {
    const expected = readWebhookSecret();
    if (!expected || secret !== expected) {
      // Refuse. ConvexError maps cleanly to a 4xx in the
      // webhook handler's catch path so Clerk will retry.
      throw new ConvexError("forbidden");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        ...(name !== null && name.length > 0 ? { name } : {}),
      });
      return existing._id;
    }
    const insertedId = await ctx.db.insert("users", {
      clerkId,
      email,
      ...(name !== null && name.length > 0 ? { name } : { name: undefined }),
      role: "Student",
    });
    const inserted = await ctx.db.get(insertedId);
    if (!inserted) throw new Error("Inserted user row missing");
    return inserted._id;
  },
});
