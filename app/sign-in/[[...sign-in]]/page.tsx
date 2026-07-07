import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  AuthShell,
  AuthFormCard,
} from "@/components/auth/AuthShell";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { clerkAppearance } from "@/components/auth/clerkAppearance";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <AuthShell
      brandPanel={<AuthBrandPanel variant="sign-in" />}
      form={
        <AuthFormCard
          title="Willkommen zurück"
          description="E-Mail oder OAuth. Wir teilen deine Daten niemals mit Modellanbietern."
        >
          <SignIn
            forceRedirectUrl="/dashboard"
            signUpUrl="/sign-up"
            appearance={clerkAppearance}
          />
        </AuthFormCard>
      }
      alternate={{
        label: "Noch kein Konto?",
        href: "/sign-up",
        cta: "Registrieren",
      }}
      legalNote="Mit der Anmeldung stimmst du den Nutzungsbedingungen und der Datenschutzerklärung zu."
    />
  );
}
