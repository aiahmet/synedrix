import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  AuthShell,
  AuthFormCard,
} from "@/components/auth/AuthShell";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { clerkAppearance } from "@/components/auth/clerkAppearance";

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <AuthShell
      brandPanel={<AuthBrandPanel variant="sign-up" />}
      form={
        <AuthFormCard
          title="Konto erstellen"
          description="Kostenlos während der Beta-Phase. Keine Kreditkarte erforderlich."
        >
          <SignUp
            forceRedirectUrl="/dashboard"
            signInUrl="/sign-in"
            appearance={clerkAppearance}
          />
        </AuthFormCard>
      }
      alternate={{
        label: "Bereits ein Konto?",
        href: "/sign-in",
        cta: "Anmelden",
      }}
      legalNote="Mit der Registrierung stimmst du den Nutzungsbedingungen und der Datenschutzerklärung zu."
    />
  );
}
