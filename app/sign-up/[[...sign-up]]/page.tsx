import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  AuthShell,
  AuthFormCard,
} from "@/components/auth/AuthShell";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { clerkAppearance } from "@/components/auth/clerkAppearance";

/**
 * /sign-up.
 *
 * Server-rendered shell that wraps Clerk's SignUp component. The
 * sign-up variant of the brand panel carries the four value
 * highlights and a short what-you-get preview so the user
 * understands the product before they commit their email.
 *
 * forceRedirectUrl points at /dashboard so new users land straight
 * on the empty cockpit.
 */
export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <AuthShell
      brandPanel={<AuthBrandPanel variant="sign-up" />}
      form={
        <AuthFormCard
          title="Create your account"
          description="Start mastering every subject with the AI-powered study OS."
        >
          <SignUp
            forceRedirectUrl="/dashboard"
            signInUrl="/sign-in"
            appearance={clerkAppearance}
          />
        </AuthFormCard>
      }
      alternate={{
        label: "Already have an account?",
        href: "/sign-in",
        cta: "Sign in",
      }}
      legalNote="By creating an account, you agree to the Terms of Service and Privacy Policy."
    />
  );
}
