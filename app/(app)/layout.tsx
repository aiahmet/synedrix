import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import {
  SquaresFour,
  BookOpen,
  ChatCircleText,
} from "@phosphor-icons/react/dist/ssr";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils/cn";

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
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex h-dvh bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-border bg-surface md:flex md:flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
              S
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
    </div>
  );
}
