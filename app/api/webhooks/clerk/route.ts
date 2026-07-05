import { NextRequest } from "next/server";
import { Webhook } from "svix";
import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";

// Use Node.js so we can require the `svix` package (its
// signature verification uses Node crypto) and the Convex
// `ConvexHttpClient`. Streaming is not used here, but Node
// keeps the bundle surface identical to the tutor route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clerk webhook receiver.
 *
 * Subscribes to user lifecycle events (`user.created`,
 * `user.updated`, `user.deleted`) from Clerk and mirrors them
 * into the Convex `users` table. The signing-identity flow
 * would otherwise leave every new sign-up with no `users` row
 * in Convex, which broke every authenticated mutation
 * downstream (`requireUser` threw "Unauthenticated" until a
 * row appeared).
 *
 * Security posture:
 *
 *  1. The inbound request carries svix headers (`svix-id`,
 *     `svix-timestamp`, `svix-signature`). We verify them
 *     against `process.env.CLERK_WEBHOOK_SECRET` before doing
 *     anything else. Bad signature → 400. Clerk will retry.
 *  2. The body is the literal signed bytes. We do not parse
 *     JSON before verification because svix signs the raw
 *     payload and any reserialization would invalidate the
 *     signature.
 *  3. The Convex mutation we call (`api.users.upsertFromClerk`)
 *     is publicly callable but secondarily gated by a
 *     `secret` argument that must match
 *     `process.env.CONVEX_WEBHOOK_SECRET`. Even if the svix
 *     secret leaked, an attacker would also need to know the
 *     Convex-side secret to write a row.
 *  4. We do NOT delete users. AGENTS.md rules: historical
 *     learning data is soft-preserved. `user.deleted` is
 *     acknowledged with 200 but otherwise ignored — if a
 *     returning user re-signs-up, their old subjects /
 *     progress come back through the existing `userSubjects`
 *     legacy-fallback path in `convex/dashboard.ts`.
 */
export async function POST(req: NextRequest) {
  const clerkSecret = process.env.CLERK_WEBHOOK_SECRET;
  const convexSecret = process.env.CONVEX_WEBHOOK_SECRET;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!clerkSecret || !convexSecret || !convexUrl) {
    // Misconfigured deployment. We do not leak which env is
    // missing in the response body.
    return new Response("Webhook not configured", { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // IMPORTANT: read the raw text body. svix verifies the literal
  // bytes; parsing then re-stringifying would invalidate the
  // signature even when the JSON is semantically identical.
  const rawBody = await req.text();

  const wh = new Webhook(clerkSecret);
  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const convex = new ConvexHttpClient(convexUrl);
  // Deliberately NOT calling `convex.setAuth`. There is no
  // Clerk session for a webhook call; the secondary secret
  // argument on `upsertFromClerk` provides the auth gate.

  try {
    if (event.type === "user.created" || event.type === "user.updated") {
      const data = event.data;
      const primaryEmail = data.email_addresses?.[0]?.email_address ?? "";
      const fullName = [data.first_name, data.last_name]
        .filter((part): part is string => typeof part === "string" && part.length > 0)
        .join(" ")
        .trim();
      const name: string | null = fullName.length > 0 ? fullName : null;
      await convex.mutation(api.users.upsertFromClerk, {
        clerkId: data.id,
        email: primaryEmail,
        name,
        secret: convexSecret,
      });
    }
    // user.deleted: intentionally a no-op. We soft-preserve
    // the row to keep `userTopicProgress` / mistakeEntries /
    // studySessions referentially intact. If the user
    // re-creates their Clerk account, the webhook fires again
    // and `upsertFromClerk` patches the existing row by
    // `clerkId`.
  } catch (err) {
    // Bind `err` so `console.error` includes the stack
    // trace in server logs. ESLint's `no-unused-vars` rule
    // is satisfied because `err` is passed to `console.error`
    // (rule counts as used). Return 500 so Clerk retries the
    // delivery. We deliberately do NOT include the error in
    // the response body to avoid leaking internals.
    console.error("clerk webhook: handler failed", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  // 200 with an empty body — Clerk's docs recommend this.
  return new Response("", { status: 200 });
}

/**
 * Minimal shape of the Clerk user webhook payload we read.
 * Typed locally rather than importing from `@clerk/nextjs` to
 * keep the entrypoint small (Clerk exports dozens of webhook
 * event types). We only need the fields we actually use.
 */
type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{
      email_address: string;
      id?: string;
    }>;
    first_name?: string | null;
    last_name?: string | null;
  };
};
