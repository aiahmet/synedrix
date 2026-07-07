import { AuthEyebrow } from "@/components/auth/AuthShell";
import {
  ArrowRight,
  ChatCircleText,
  GitFork,
  ShieldCheck,
  Sparkle,
} from "@/components/landing/icons";

/**
 * AuthBrandPanel.
 *
 * The left half of the auth layout.
 *
 * Anti-slop:
 *   - No carded highlight rows. The previous version wrapped each
 *     row in `border bg-surface-elevated/40 p-3.5`, which reads as
 *     "list of feature cards" — the visual language of a generic
 *     SaaS landing page. The new version lets the typography
 *     breathe, with a clean icon + title + body triplet.
 *   - No proof checkmark list. The previous version had three
 *     `icon checkmark + string` rows under the highlights. That
 *     is a marketing-page cliche. The GitHub link + licence line
 *     at the bottom is enough proof of openness.
 *   - No icon container with `bg-accent/10 ring-1 ring-accent/10`.
 *     Icons render at their natural size in `text-muted-foreground`
 *     and brighten on hover. Editorial, not emoji-pill.
 *   - Editorial H2 with tight `tracking-[-0.024em]` and a small
 *     `leading-[1.04]`. The `<br />` mid-headline gives a magazine
 *     feel — the headline is the design, not the surrounding card.
 *
 * Sign-in vs sign-up:
 *   - Sign-in: three short rows that *reassure* a returning user
 *     (continuity, tutor memory, privacy). No sales pitch.
 *   - Sign-up: four rows of *what you get* (architecture, depth
 *     switching, AI structure, openness). Sells the product.
 */

interface Row {
  readonly icon: typeof Sparkle;
  readonly title: string;
  readonly body: string;
}

const SIGN_IN_ROWS: readonly Row[] = [
  {
    icon: Sparkle,
    title: "Continue exactly where you left off",
    body: "Mastery, recent mistakes, and the review queue all load on the next click.",
  },
  {
    icon: ChatCircleText,
    title: "The tutor already knows your context",
    body: "Subject, topic, and recent errors sync across every device you use.",
  },
  {
    icon: ShieldCheck,
    title: "Your data never leaves your tenant",
    body: "We never sell, share, or train models on your work.",
  },
];

const SIGN_UP_ROWS: readonly Row[] = [
  {
    icon: Sparkle,
    title: "Five systems, one cockpit",
    body: "Curriculum map, tutor, practice, review, and planner — all reading the same state.",
  },
  {
    icon: ChatCircleText,
    title: "Three depths per topic, on one page",
    body: "Switch from Simple to Standard to Rigorous without losing your place.",
  },
  {
    icon: ShieldCheck,
    title: "Structured AI, schema-validated, logged",
    body: "Every generation runs through Zod and is written to the AiGeneration telemetry table.",
  },
  {
    icon: GitFork,
    title: "Open source, MIT-licensed",
    body: "Self-host, fork, or contribute. Take your data with you at any time.",
  },
];

/**
 * A short, calm stat strip that gives the brand panel enough
 * weight to not feel sparse. Used only on sign-in (sign-up's
 * four highlights already provide density). Numbers are real,
 * not campaign numbers: 1 cockpit + 5 systems = 1 dashboard
 * unifying curriculum, tutor, practice, review, and planner.
 */
const SIGN_IN_STAT = "1 cockpit · 5 systems · always-on review queue";

export function AuthBrandPanel({
  variant,
}: {
  readonly variant: "sign-in" | "sign-up";
}) {
  const isSignIn = variant === "sign-in";
  const rows = isSignIn ? SIGN_IN_ROWS : SIGN_UP_ROWS;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-7 lg:gap-9">
      <div className="flex flex-col gap-4">
        <AuthEyebrow>{isSignIn ? "Welcome back" : "Get started"}</AuthEyebrow>
        <h2 className="text-balance text-[clamp(1.95rem,2.4vw+0.5rem,2.75rem)] font-semibold leading-[1.04] tracking-[-0.024em] text-foreground">
          {isSignIn ? (
            <>
              Pick up where
              <br />
              you left off.
            </>
          ) : (
            <>
              The intelligence layer
              <br />
              for your Abitur.
            </>
          )}
        </h2>
        <p className="max-w-md text-pretty text-[14.5px] leading-[1.55] text-muted-foreground">
          {isSignIn
            ? "Your streak, your review queue, and your tutor context are waiting on the other side of this form. Email or OAuth — your choice."
            : "One tab, five hours of focused study. Everything you need to go from \"I don't get this\" to \"I can solve this alone.\""}
        </p>
      </div>

      {isSignIn && (
        <div
          className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80"
          aria-label="Architecture summary"
        >
          {SIGN_IN_STAT}
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <li
            key={row.title}
            className="group flex items-start gap-3.5"
          >
            <row.icon
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              weight="duotone"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">
                {row.title}
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-muted-foreground">
                {row.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1.5 border-t border-border pt-5">
        <a
          href="https://github.com/aiahmet/synedrix"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:text-accent"
        >
          View the source on GitHub
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            weight="bold"
          />
        </a>
        <p className="text-[11.5px] text-muted-foreground/80">
          MIT licensed. Self-host or use the hosted instance.
        </p>
      </div>
    </div>
  );
}
