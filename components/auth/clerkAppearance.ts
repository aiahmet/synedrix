/**
 * ClerkAppearance.
 *
 * Structural alias for Clerk's `Appearance` shape. We deliberately
 * avoid importing `@clerk/types` directly because it is a transitive
 * dependency of `@clerk/nextjs` and may not be resolvable from every
 * downstream project root. Clerk's per-component prop types
 * (e.g. `<SignIn appearance>`) are intentionally narrower than the
 * full `Appearance` type, so deriving from them would block valid
 * properties such as `colorInputBackground`. We declare the shape
 * we intend to produce instead, which keeps the file type-safe,
 * self-documenting, and zero new dependencies.
 *
 * Only the keys we actually populate are typed. Clerk's runtime
 * accepts the full object as-is, and unknown keys are ignored.
 */
interface ClerkAppearance {
  readonly variables?: {
    readonly colorPrimary?: string;
    readonly colorBackground?: string;
    readonly colorInputBackground?: string;
    readonly colorInputText?: string;
    readonly colorText?: string;
    readonly colorTextSecondary?: string;
    readonly colorTextOnPrimaryBackground?: string;
    readonly colorInputBorder?: string;
    readonly colorNeutral?: string;
    readonly colorDanger?: string;
    readonly colorSuccess?: string;
    readonly colorWarning?: string;
    readonly borderRadius?: string;
    readonly fontFamily?: string;
    readonly fontFamilyButtons?: string;
    readonly fontSize?: string;
    readonly fontWeight?: { readonly normal?: number; readonly medium?: number; readonly semibold?: number; readonly bold?: number };
    readonly spacingUnit?: string;
  };
  readonly elements?: Record<string, string>;
  readonly layout?: {
    readonly socialButtonsPlacement?: "top" | "bottom";
    readonly showOptionalFields?: boolean;
    readonly termsPageUrl?: string;
    readonly privacyPageUrl?: string;
  };
}

/**
 * Shared Clerk appearance config.
 *
 * Pulls the design tokens from our CSS variables so the Clerk forms
 * look native to the rest of the app. Variables are read at render
 * time on the client, so they pick up the active theme automatically.
 *
 * The class strings mirror the design system we ship in globals.css:
 *   - h-11 inputs with rounded-lg corners
 *   - h-11 primary button with the teal accent
 *   - focus rings driven by the --ring variable
 *   - h-11 social buttons with proper borders
 *   - 14px input text, 13px form field labels
 */
export const clerkAppearance: ClerkAppearance = {
  variables: {
    colorPrimary: "var(--accent)",
    colorBackground: "transparent",
    colorInputBackground: "var(--surface-elevated)",
    colorInputText: "var(--foreground)",
    colorText: "var(--foreground)",
    colorTextSecondary: "var(--muted-foreground)",
    colorNeutral: "var(--border)",
    colorDanger: "var(--subject-french)",
    colorSuccess: "var(--subject-chemistry)",
    colorWarning: "var(--subject-german)",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-sans)",
    fontFamilyButtons: "var(--font-sans)",
    fontSize: "0.875rem",
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    spacingUnit: "1rem",
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none bg-transparent p-0 w-full border-0",
    cardBox: "w-full",
    main: "w-full gap-0",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    headerBackLink:
      "text-muted-foreground hover:text-foreground text-sm font-medium",
    socialButtonsBlockButton:
      "h-11 rounded-lg border border-border bg-surface-elevated hover:bg-surface text-foreground text-sm font-medium transition-colors",
    socialButtonsBlockButtonText: "text-sm font-medium",
    socialButtonsBlockButtonArrow: "hidden",
    socialButtonsProviderIcon: "h-4 w-4",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground text-xs uppercase tracking-wider",
    dividerRow: "my-5",
    formFieldLabelRow: "mb-1.5",
    formFieldLabel: "text-[13px] font-medium text-foreground",
    formFieldLabelIcon: "hidden",
    formFieldInput:
      "h-11 rounded-lg border border-border bg-surface-elevated px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-shadow",
    formFieldInputGroup: "rounded-lg",
    formFieldAction: "text-accent hover:text-accent/80 text-xs font-medium",
    formFieldErrorText: "text-xs text-subject-french mt-1.5",
    formFieldSuccessText: "text-xs text-subject-chemistry mt-1.5",
    formFieldHintText: "text-xs text-muted-foreground mt-1.5",
    formButtonPrimary:
      "h-11 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-[0.98] shadow-none",
    formButtonReset:
      "h-11 rounded-lg border border-border bg-surface-elevated text-foreground text-sm font-medium hover:bg-surface transition-colors",
    formResendCodeLink: "text-accent text-sm font-medium",
    otpCodeFieldInput:
      "h-12 w-10 rounded-lg border border-border bg-surface-elevated text-foreground text-center text-base font-medium focus:ring-2 focus:ring-ring focus:border-ring",
    footerAction: "pt-3",
    footerActionLink:
      "text-accent hover:text-accent/80 text-sm font-medium",
    footerActionText: "text-muted-foreground text-sm",
    identityPreviewText: "text-sm text-foreground",
    identityPreviewEditButton: "text-accent text-sm font-medium",
    alert:
      "rounded-lg border border-subject-french/30 bg-subject-french/10 text-subject-french text-sm p-3",
    alertText: "text-sm",
    alertIcon: "h-4 w-4",
    verificationLinkStatusIcon__success: "fill-subject-chemistry",
    formFieldSuccess: "border-subject-chemistry/30",
    alternativeMethodsBlockButton:
      "h-11 rounded-lg border border-border bg-surface-elevated hover:bg-surface text-foreground text-sm font-medium",
    phoneInputBox: "rounded-lg",
  },
  layout: {
    socialButtonsPlacement: "top",
    showOptionalFields: false,
    termsPageUrl: "/terms",
    privacyPageUrl: "/privacy",
  },
};
