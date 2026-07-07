import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { ArrowLeft } from "@/components/landing/icons";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "Unknown";
  const name = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.username ?? "Student";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1.5 pt-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          / settings
        </span>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Settings
        </h1>
      </header>

      <CockpitCard>
        <CockpitCardHeader label="Account" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Name</span>
            <span className="text-[14px] font-medium text-foreground">{name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Email</span>
            <span className="text-[14px] font-medium text-foreground">{email}</span>
          </div>
          <Link
            href="https://accounts.clerk.com/user"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-border bg-background px-4 text-[12px] font-medium text-foreground transition-colors hover:bg-surface"
          >
            Manage account on Clerk
          </Link>
        </div>
      </CockpitCard>

      <CockpitCard>
        <CockpitCardHeader label="Data" />
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Your study data lives in your Convex deployment. Data export and account deletion are
            available through your account settings.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="https://accounts.clerk.com/user"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-[12px] font-medium text-foreground transition-colors hover:bg-surface"
            >
              Export data
            </Link>
            <Link
              href="https://accounts.clerk.com/user"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-4 text-[12px] font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-900"
            >
              Delete account
            </Link>
          </div>
        </div>
      </CockpitCard>

      <Link
        href="/dashboard"
        className="inline-flex h-9 w-fit items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
        Back to dashboard
      </Link>
    </div>
  );
}
