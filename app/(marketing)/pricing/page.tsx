import Link from "next/link";
import Image from "next/image";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";

const plans = [
  {
    name: "Kostenlos",
    price: "€0",
    period: "dauerhaft",
    description: "Alles, was ein einzelner Schüler braucht, um fünf Fächer zu lernen.",
    features: [
      "Vollständiger Lehrplan für 6 Fächer",
      "KI-Tutor mit kontextsensitivem Chat",
      "Unbegrenzte Übungssätze",
      "Fehlernachverfolgung und -analyse",
      "Spaced-Repetition-Karteikarten",
      "Lernplaner und Fokusmodus",
      "Wöchentliches Konsistenz-Tracking",
      "1 Gerät",
    ],
    cta: "Loslegen",
    href: "/sign-up",
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavBar />
      <main className="flex-1">
        <section className="px-6 pb-24 pt-20 sm:pb-32 sm:pt-28">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                Preise
              </span>
              <h1 className="max-w-2xl text-balance text-[clamp(2rem,3vw+1rem,3.25rem)] font-bold leading-[1.04] tracking-[-0.04em] text-foreground">
                Ein Schüler, ein Preis.
              </h1>
              <p className="max-w-lg text-pretty text-[14.5px] leading-[1.55] text-muted-foreground">
                Study OS ist für einen einzelnen Gymnasiasten konzipiert. Keine Enterprise-Tarife,
                keine Abrechnung pro Benutzer, keine versteckten Limits. Vollständiger Zugang, während der Beta dauerhaft kostenlos.
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-sm">
              <div className="relative rounded-xl border border-border bg-background p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:border-border/60 dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded border border-border bg-background px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-accent">
                  Beta
                </div>

                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl">
                    <Image
                      src="/synedrix-logo.png"
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-[40px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">
                        {plans[0].price}
                      </span>
                      <span className="text-[14px] text-muted-foreground">
                        / {plans[0].period}
                      </span>
                    </div>
                    <span className="text-[13px] font-medium text-foreground">{plans[0].name}</span>
                  </div>

                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                    {plans[0].description}
                  </p>

                  <ul className="flex w-full flex-col gap-2 text-left">
                    {plans[0].features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-[13px]">
                        <span className="text-foreground/30 font-mono" aria-hidden>&mdash;</span>
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plans[0].href}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-accent px-6 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 shadow-none"
                  >
                    {plans[0].cta}
                  </Link>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-16 max-w-lg text-center">
              <p className="text-[12.5px] leading-relaxed text-muted-foreground/80">
                Synedrix befindet sich in aktiver Entwicklung. Während der Beta-Phase sind alle Funktionen kostenlos.
                Zukünftige Preise werden fair, transparent und schülerfreundlich sein &ndash;
                keine Lizenzen für ganze Schulbezirke, kein institutioneller Overhead.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
