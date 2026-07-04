import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { ContributingSection } from "@/components/landing/ContributingSection";
import { DataModel } from "@/components/landing/DataModel";
import { DesignSection } from "@/components/landing/DesignSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { GettingStarted } from "@/components/landing/GettingStarted";
import { HeroSection } from "@/components/landing/HeroSection";
import { LearningLoop } from "@/components/landing/LearningLoop";
import { NavBar } from "@/components/landing/NavBar";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { Roadmap } from "@/components/landing/Roadmap";
import { SubjectBreakdown } from "@/components/landing/SubjectBreakdown";
import { SurfacesBento } from "@/components/landing/SurfacesBento";
import { TechStack } from "@/components/landing/TechStack";
import { TrustedBar } from "@/components/landing/TrustedBar";

/**
 * Marketing entry point.
 *
 * Composition (14 distinct sections, 9 layout families):
 *   1. Hero              - editorial split with product preview
 *   2. Trusted           - quiet logo strip
 *   3. Problem           - editorial stacked center + asymmetric 5/7/12
 *   4. Surfaces          - 9-cell bento with real product mocks
 *   5. Learning loop     - interactive horizontal timeline + detail panel
 *   6. Subjects          - 6-cell grid showing subject-specific workflows
 *   7. Architecture      - 50/50 code cards + 8-cell pillar band
 *   8. Data model        - filterable 13-entity table by tier
 *   9. Design            - 4-card principles grid with do/dont lists
 *  10. Tech stack        - 8-row table reference
 *  11. Getting started   - prerequisites strip + 3 numbered code previews
 *  12. Roadmap           - 4-phase progress rail
 *  13. FAQ               - accordion with 8 substantive answers
 *  14. Contributing      - 7/5 editorial split with primary action row
 *  15. Final CTA         - oversized gradient atmosphere with stat strip
 *  16. Footer            - 6/6 brand + spec chips + two link columns
 *
 * Layout families used (no two adjacent share one):
 *   split, strip, stacked-center, bento, timeline, grid, zig-zag,
 *   table, accordion, gradient.
 *
 * Server-rendered for SEO and to keep the redirect path tight.
 * Client Islands are isolated to the section files.
 */
export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main id="main">
        <HeroSection />
        <TrustedBar />
        <ProblemSection />
        <SurfacesBento />
        <LearningLoop />
        <SubjectBreakdown />
        <ArchitectureSection />
        <DataModel />
        <DesignSection />
        <TechStack />
        <GettingStarted />
        <Roadmap />
        <FaqSection />
        <ContributingSection />
        <Suspense>
          <FinalCTA />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
