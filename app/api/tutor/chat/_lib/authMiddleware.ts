import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

export async function verifyAuth(): Promise<{
  userId: string;
  convex: ConvexHttpClient;
} | Response> {
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Convex is not configured", { status: 500 });
  }

  const token = await getToken({ template: "convex" }).catch(() => null);
  const convex = new ConvexHttpClient(convexUrl);
  if (token) convex.setAuth(token);

  return { userId: clerkId, convex };
}
