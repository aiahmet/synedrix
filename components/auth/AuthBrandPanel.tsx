import { AuthEyebrow } from "@/components/auth/AuthShell";
import {
  ArrowRight,
  ChatCircleText,
  GitFork,
  ShieldCheck,
  Sparkle,
} from "@/components/landing/icons";

interface Row {
  readonly icon: typeof Sparkle;
  readonly title: string;
  readonly body: string;
}

const SIGN_IN_ROWS: readonly Row[] = [
  {
    icon: Sparkle,
    title: "Setze dein Lernen nahtlos fort",
    body: "Lernstand, Fehler und deine Wiederholungsliste laden mit dem nächsten Klick.",
  },
  {
    icon: ChatCircleText,
    title: "Der Tutor kennt deinen Kontext",
    body: "Fach, Thema und deine letzten Fehler synchronisieren sich auf allen Geräten.",
  },
  {
    icon: ShieldCheck,
    title: "Deine Daten gehören dir",
    body: "Wir verkaufen oder teilen deine Daten niemals und nutzen sie nicht zum Training von KI-Modellen.",
  },
];

const SIGN_UP_ROWS: readonly Row[] = [
  {
    icon: Sparkle,
    title: "Fünf Systeme, ein Cockpit",
    body: "Lehrplan, Tutor, Übungen, Wiederholungen und Planer nutzen alle denselben Zustand.",
  },
  {
    icon: ChatCircleText,
    title: "Drei Erklärungstiefen pro Thema",
    body: "Wechsle einfach zwischen Einfach, Standard und Anspruchsvoll, ohne den Faden zu verlieren.",
  },
  {
    icon: ShieldCheck,
    title: "Strukturierte KI, validiert und protokolliert",
    body: "Jede Antwort wird per Zod-Schema validiert und in unserer AiGeneration-Tabelle erfasst.",
  },
  {
    icon: GitFork,
    title: "Open Source unter MIT-Lizenz",
    body: "Selbst hosten, forken oder beitragen. Du kannst deine Daten jederzeit exportieren.",
  },
];

const SIGN_IN_STAT = "1 Cockpit · 5 Systeme · aktive Wiederholungsliste";

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
        <AuthEyebrow>{isSignIn ? "Willkommen zurück" : "Erste Schritte"}</AuthEyebrow>
        <h2 className="text-balance text-[clamp(1.95rem,2.4vw+0.5rem,2.75rem)] font-semibold leading-[1.04] tracking-[-0.024em] text-foreground">
          {isSignIn ? (
            <>
              Mach weiter, wo du
              <br />
              aufgehört hast.
            </>
          ) : (
            <>
              Die Intelligenzschicht
              <br />
              für dein Abitur.
            </>
          )}
        </h2>
        <p className="max-w-md text-pretty text-[14px] leading-[1.55] text-muted-foreground">
          {isSignIn
            ? "Dein Streak, deine Wiederholungen und dein Tutor-Kontext warten auf dich. Per E-Mail oder OAuth – ganz wie du möchtest."
            : "Ein Tab, fokussiertes Lernen. Alles, was du brauchst, um vom „Ich verstehe das nicht“ zum „Ich kann das alleine lösen“ zu kommen."}
        </p>
      </div>

      {isSignIn && (
        <div
          className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80"
          aria-label="Architektur-Zusammenfassung"
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
          Quellcode auf GitHub ansehen
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            weight="bold"
          />
        </a>
        <p className="text-[11.5px] text-muted-foreground/80">
          Unter MIT-Lizenz. Selbst hosten oder die gehostete Instanz nutzen.
        </p>
      </div>
    </div>
  );
}
