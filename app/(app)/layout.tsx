import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { fetchQuery } from "convex/nextjs";
import {
  SquaresFour,
  BookOpen,
  ChatCircleText,
} from "@phosphor-icons/react/dist/ssr";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils/cn";
import { api } from "@/convex/_generated/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", Icon: SquaresFour },
  { href: "/subjects", label: "Subjects", Icon: BookOpen },
  { href: "/tutor", label: "Tutor", Icon: ChatCircleText },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  // Read the pathname exactly once. `headers()` is a
  // per-request dynamic API, so two reads in the same
  // render are wasteful at minimum (and may emit warnings
  // in some Next.js builds). The pathname branches the
  // onboarding gate AND the chrome decision below.
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const isOnboardingPath = pathname.startsWith("/onboarding");

  // Onboarding gate. The (app) layout owns the redirect
  // graph: every protected page that is not `/onboarding`
  // redirects in when the user is not yet onboarded; the
  // `/onboarding` page redirects out when they are. The two
  // conditions are mutually exclusive so there is no
  // redirect loop.
  //
  // We deliberately fail-open if Convex is unreachable:
  // when we cannot decide, we let the request continue
  // (rather than over-redirecting) so a Convex outage does
  // not trap the user. The `/onboarding/page.tsx` mirrors
  // the out-redirect so the loop stays symmetric.
  //
  // Two notes on the implementation:
  //
  //  1. **Forward the Clerk JWT.** `fetchQuery` from
  //     `convex/nextjs` does not automatically forward auth
  //     tokens when called from server components. We mint
  //     a Clerk JWT against the `convex` template (the same
  //     one `convex/auth.config.ts` validates) and pass it
  //     as the third argument. Without the token the query
  //     sees no identity and `getOnboardingStatus` returns
  //     `{signedIn: false}`, blocking the redirect.
  //  2. **Move `redirect()` out of the try/catch.**
  //     `next/navigation`'s `redirect` throws an internal
  //     `NEXT_REDIRECT` error that Next.js uses to perform
  //     the redirect. Wrapping it in a plain `try { ...
  //     redirect(...) } catch {}` silently swallows that
  //     signal — the redirect is lost and the request
  //     renders the protected page anyway. We set a flag
  //     and call `redirect()` outside the try block.
  let shouldRedirectToOnboarding = false;
  if (!isOnboardingPath) {
    try {
      const token = await getToken({ template: "convex" }).catch(() => null);
      const status = await fetchQuery(
        api.users.getOnboardingStatus,
        {},
        token ? { token } : {}
      );
      if (status.signedIn && !status.onboardingComplete) {
        shouldRedirectToOnboarding = true;
      }
    } catch {
      // Best-effort: if Convex throws, fall through.
    }
  }

  if (shouldRedirectToOnboarding) {
    redirect("/onboarding");
  }

  return (
    <div className="flex w-full h-dvh bg-background">
      {isOnboardingPath ? (
        <OnboardingChrome>{children}</OnboardingChrome>
      ) : (
        <>
          {/* Sidebar (desktop) */}
          <aside className="hidden w-56 flex-shrink-0 border-r border-border bg-surface md:flex md:flex-col">
            <div className="flex h-14 items-center gap-3 border-b border-border px-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
              >
                <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md">
                  <Image
                    src="/synedrix-logo.png"
                    alt=""
                    fill
                    className="object-cover"
                    sizes="28px"
                  />
                </div>
                Synedrix
              </Link>
            </div>

            <nav className="flex-1 space-y-0.5 p-2">
              {navItems.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                >
                  <Icon className="h-5 w-5" weight="duotone" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>

            <div className="border-t border-border p-3">
              <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "h-8 w-8",
                      userButtonTrigger:
                        "focus:ring-2 focus:ring-ring rounded-full",
                    },
                  }}
                />
                <span className="text-sm text-muted-foreground">Account</span>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top bar */}
            <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
              <span className="text-sm text-muted-foreground">
                Your personal learning operating system
              </span>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <div className="md:hidden">
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "h-8 w-8",
                      },
                    }}
                  />
                </div>
              </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
              {children}
            </main>
          </div>

          {/* Mobile bottom tab bar (md:hidden). Fixed at the
              bottom of the viewport with safe-area padding for
              iOS home-indicator devices. The bar mirrors the
              desktop sidebar's three primary destinations. */}
          <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-surface-elevated/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl md:hidden"
          >
            {navItems.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
                )}
              >
                <Icon className="h-5 w-5" weight="duotone" />
                <span>{label}</span>
              </Link>
            ))}
            <div className="flex min-w-[64px] flex-col items-center gap-0.5 py-1.5">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7",
                    userButtonTrigger:
                      "focus:ring-2 focus:ring-ring rounded-full",
                  },
                }}
              />
              <span className="text-[10.5px] font-medium text-muted-foreground">
                Account
              </span>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

/**
 * OnboardingChrome.
 *
 * The stripped outer frame rendered when the user is on
 * `/onboarding`. Just the logo on the left and a ThemeToggle
 * on the right, no nav, no sidebar. The whole vertical
 * viewport is dedicated to the onboarding content so the
 * full-screen focus experience reads as one composition.
 *
 * Server-rendered (no client behavior) so it stays under
 * the layout-level Suspense boundary cleanly.
 */
function OnboardingChrome({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface-elevated/80 px-6 backdrop-blur-xl">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md">
            <Image
              src="/synedrix-logo.png"
              alt=""
              fill
              className="object-cover"
              sizes="28px"
            />
          </div>
          Synedrix
          <span className="ml-1 hidden rounded-full border border-border bg-surface px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
            Onboarding
          </span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
