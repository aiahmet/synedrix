import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { fetchQuery } from "convex/nextjs";
import {
  SquaresFour,
  BookOpen,
  ChatCircleText,
  ClockCounterClockwise,
  UserCircle,
  Target,
  Calendar,
} from "@phosphor-icons/react/dist/ssr";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ActiveSessionIndicator } from "@/components/layout/ActiveSessionIndicator";
import { NavTutorBadge } from "@/components/layout/NavTutorBadge";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { TopBarTimer } from "@/components/layout/TopBarTimer";
import { cn } from "@/lib/utils/cn";
import { api } from "@/convex/_generated/api";

const navItems: ReadonlyArray<{
  readonly href: string;
  readonly label: string;
  readonly Icon: typeof SquaresFour;
  readonly withBadge?: "tutor";
}> = [
  { href: "/dashboard", label: "Cockpit", Icon: SquaresFour },
  { href: "/subjects", label: "Fächer", Icon: BookOpen },
  { href: "/planner", label: "Planer", Icon: Calendar },
  { href: "/review", label: "Wiederholungen", Icon: ClockCounterClockwise },
  { href: "/tutor", label: "KI-Tutor", Icon: ChatCircleText, withBadge: "tutor" },
  { href: "/my-topics", label: "Deine Themen", Icon: UserCircle },
  { href: "/practice", label: "Übungsarena", Icon: Target },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const firstName = user?.firstName ?? "Schüler";

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const isOnboardingPath = pathname.startsWith("/onboarding");

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
              {navItems.map(({ href, label, Icon, withBadge }) => {
                const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-foreground/[0.05] text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    )}
                  >
                    <span className="relative">
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-colors",
                          active ? "text-accent" : "text-muted-foreground/80"
                        )}
                        weight="duotone"
                      />
                      {withBadge === "tutor" && <NavTutorBadge variant="desktop" />}
                    </span>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border p-3">
              <div className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 hover:bg-surface-elevated/40 transition-colors">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "h-7 w-7",
                      userButtonTrigger:
                        "focus:ring-1 focus:ring-foreground/40 rounded-full",
                    },
                  }}
                />
                <div className="flex flex-col min-w-0 leading-none">
                  <span className="text-[12.5px] font-semibold text-foreground truncate">
                    {firstName}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    Konto
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top bar */}
            <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
              <span className="text-sm text-muted-foreground">
                Dein persönliches Lern-Betriebssystem
              </span>
              <div className="flex items-center gap-3">
                <GlobalSearch />
                <TopBarTimer />
                <ActiveSessionIndicator variant="desktop" />
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

          {/* Mobile bottom tab bar (md:hidden) */}
          <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-surface-elevated/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl md:hidden"
          >
            {navItems.map(({ href, label, Icon, withBadge }) => {
              const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group flex min-w-[60px] flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated",
                    active
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="relative">
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-colors",
                        active ? "text-accent" : "text-muted-foreground/80"
                      )}
                      weight="duotone"
                    />
                    {withBadge === "tutor" && <NavTutorBadge variant="mobile" />}
                  </span>
                  <span>{label}</span>
                </Link>
              );
            })}
            <ActiveSessionIndicator variant="mobile" />
            <div className="flex min-w-[60px] flex-col items-center gap-0.5 py-1.5">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7",
                    userButtonTrigger:
                      "focus:ring-2 focus:ring-ring rounded-full",
                  },
                }}
              />
              <span className="text-[10px] font-medium text-muted-foreground">
                Konto
              </span>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

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
