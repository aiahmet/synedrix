import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AdaptiveAI } from "@/components/landing/AdaptiveAI";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { LearningLoop } from "@/components/landing/LearningLoop";
import { NavBar } from "@/components/landing/NavBar";
import { PlatformSystems } from "@/components/landing/PlatformSystems";
import { SubjectCarousel } from "@/components/landing/SubjectCarousel";

/**
 * Marketing entry point.
 *
 * Composition (9 sections, in order):
 *   1. Hero              - full-viewport editorial + glass cockpit mockup
 *   2. Learning loop     - six-step snake-pattern workflow with animated spine
 *   3. Platform systems  - tabbed macOS browser previews of 5 intelligent systems
 *   4. Adaptive AI       - split-screen: editorial + living knowledge graph
 *   5. Subject carousel  - full-width carousel with per-subject panels + patterns
 *   6. Comparison        - traditional fragmentation vs. unified Synedrix
 *   7. FAQ               - accordion with substantive answers
 *   8. Final CTA         - editorial conversion Closer
 *   9. Footer            - brand column + link columns
 *
 * Narrative arc:
 *   What it is → How it works → What it looks like → Why it's smart →
 *   Works for everything → Why switch → Questions → Close → Done.
 */
export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main id="main">
        <HeroSection />
        <LearningLoop />
        <PlatformSystems />
        <AdaptiveAI />
        <SubjectCarousel />
        <ComparisonSection />
        <FaqSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
