import { AuthEyebrow } from "@/components/auth/AuthShell";
import {
  ChatCircleText,
  Check,
  Command,
  GitFork,
  ShieldCheck,
  Sparkle,
} from "@/components/landing/icons";

/**
 * AuthBrandPanel.
 *
 * The left half of the auth layout. Carries a short, calm value prop
 * and three or four supporting points. Two variants: sign-in (which
 * leans on returning-user proof) and sign-up (which leans on feature
 * proof and a quick what-you-get preview).
 *
 * The panel is a Server Component. The icons are server-rendered
 * Phosphor, so no client boundary is crossed.
 */

interface Highlight {
  readonly icon: typeof Sparkle;
  readonly title: string;
  readonly body: string;
}

const SIGN_IN_HIGHLIGHTS: readonly Highlight[] = [
  {
    icon: Sparkle,
    title: "Your state is exactly where you left it",
    body: "Mastery, recent mistakes, and review queue all load on the next click.",
  },
  {
    icon: ChatCircleText,
    title: "The tutor already knows your context",
    body: "Subject, topic, and recent mistakes travel with you across devices.",
  },
  {
    icon: GitFork,
    title: "Free, open source, no credit card",
    body: "The whole project is MIT licensed. Personal workspaces are free.",
  },
];

const SIGN_UP_HIGHLIGHTS: readonly Highlight[] = [
  {
    icon: Sparkle,
    title: "Five systems, one state",
    body: "Curriculum map, AI tutor, practice engine, review queue, planner all read from the same data.",
  },
  {
    icon: ChatCircleText,
    title: "Three depths per topic, on one page",
    body: "Simple, Standard, or Rigorous. Switch depths without losing your place.",
  },
  {
    icon: ShieldCheck,
    title: "Structured AI, validated, logged",
    body: "Every generation is schema-validated and written to the AiGeneration telemetry table.",
  },
  {
    icon: GitFork,
    title: "Free, open source, no credit card",
    body: "The whole project is MIT licensed. Personal workspaces are free.",
  },
];

const SIGN_IN_PROOF: readonly string[] = [
  "Realtime sync via Convex",
  "Works on mobile, tablet, desktop",
  "No telemetry shared with model providers",
];

const SIGN_UP_PROOF: readonly string[] = [
  "OAuth with Google, GitHub, and email",
  "Single-user, focused, fast",
  "Cancel any time, take your data with you",
];

export function AuthBrandPanel({
  variant,
}: {
  readonly variant: "sign-in" | "sign-up";
}) {
  const isSignIn = variant === "sign-in";
  const highlights = isSignIn ? SIGN_IN_HIGHLIGHTS : SIGN_UP_HIGHLIGHTS;
  const proof = isSignIn ? SIGN_IN_PROOF : SIGN_UP_PROOF;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-7 lg:gap-9">
      <div className="flex flex-col gap-5">
        <AuthEyebrow>
          {isSignIn ? "Welcome back" : "Get started"}
        </AuthEyebrow>
        <h2 className="text-balance text-[clamp(1.85rem,3vw+0.5rem,2.75rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          {isSignIn ? (
            <>
              Pick up where
              <br />
              you left off.
            </>
          ) : (
            <>
              Start the system
              <br />
              that compounds with you.
            </>
          )}
        </h2>
        <p className="max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">
          {isSignIn
            ? "Your streak, your review queue, your tutor context, all waiting on the other side of this form. Email or OAuth, your choice."
            : "One tab, five hours of focused study. Everything you need to go from \u201cI don\u2019t get this\u201d to \u201cI can solve this alone\u201d."}
        </p>
      </div>

      <ul className="flex flex-col gap-3.5">
        {highlights.map((h) => (
          <li
            key={h.title}
            className="group flex items-start gap-3.5 rounded-xl border border-border/60 bg-surface-elevated/40 p-3.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/10">
              <h.icon className="h-[1.05rem] w-[1.05rem] text-accent" weight="duotone" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold leading-tight tracking-tight text-foreground">
                {h.title}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {h.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <ul className="flex flex-col gap-2 border-t border-border/60 pt-5">
        {proof.map((line) => (
          <li
            key={line}
            className="flex items-center gap-2 text-[12.5px] text-muted-foreground"
          >
            <Check
              className="h-3.5 w-3.5 text-accent"
              weight="bold"
              aria-hidden
            />
            {line}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 border-t border-border/60 pt-5 text-[12px] text-muted-foreground">
        <Command className="h-3.5 w-3.5" weight="duotone" />
        <span>
          Source on{" "}
          <a
            href="https://github.com/aiahmet/synedrix"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground transition-colors hover:text-accent"
          >
            GitHub
          </a>
          . MIT licensed.
        </span>
      </div>
    </div>
  );
}

