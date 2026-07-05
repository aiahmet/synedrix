import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/pricing",
]);

export default clerkMiddleware(async (auth, req) => {
  // Pathname pass-through so server components inside the
  // `(app)` route group can branch on the URL without a
  // client-side router. The `(app)/layout.tsx` onboarding
  // gate reads this header to skip the redirect when the
  // caller is already on `/onboarding`. Pass `request: {
  // headers }` so the rewritten headers reach the layout
  // through the standard Request lifecycle.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
