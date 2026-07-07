import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  AuthShell,
  AuthFormCard,
} from "@/components/auth/AuthShell";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { clerkAppearance } from "@/components/auth/clerkAppearance";

/**
 * /sign-in.
 *
 * Server-rendered shell that wraps Clerk's SignIn component. The
 * shell carries the brand panel on the left and a clean form card
 * on the right. The Clerk component is responsible for everything
 * inside the card; the page only handles the redirect and shell.
 *
 * forceRedirectUrl points at /dashboard so returning users land
 * straight on the cockpit.
 */
export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <AuthShell
      brandPanel={<AuthBrandPanel variant="sign-in" />}
      form={
        <AuthFormCard
          title="Welcome back"
          description="Email or OAuth. We never share your data with model providers."
        >
          <SignIn
            forceRedirectUrl="/dashboard"
            signUpUrl="/sign-up"
            appearance={clerkAppearance}
          />
        </AuthFormCard>
      }
      alternate={{
        label: "Need an account?",
        href: "/sign-up",
        cta: "Create one",
      }}
      legalNote="By signing in, you agree to the Terms of Service and Privacy Policy."
    />
  );
}
