/**
 * ClerkAppearance.
 *
 * Structural alias for Clerk's `Appearance` shape.
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
    borderRadius: "0.375rem",
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
    headerBackLink: "text-muted-foreground hover:text-foreground text-sm font-medium",
    socialButtonsBlockButton:
      "h-10 rounded-md border border-border bg-background hover:bg-muted-foreground/5 text-foreground text-[13px] font-medium transition-colors shadow-none",
    socialButtonsBlockButtonText: "text-[13px] font-medium text-foreground",
    socialButtonsBlockButtonArrow: "hidden",
    socialButtonsProviderIcon: "h-4 w-4 shrink-0",
    dividerLine: "bg-border",
    dividerText:
      "text-muted-foreground text-[11.5px] font-normal normal-case tracking-normal px-2.5 bg-background",
    dividerRow: "my-6",
    formFieldLabelRow: "mb-1.5",
    formFieldLabel:
      "text-[12.5px] font-medium text-foreground tracking-[-0.005em]",
    formFieldLabelIcon: "hidden",
    formFieldInput:
      "h-10 rounded-md border border-border bg-surface-elevated px-3.5 text-[13.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground/40 transition-colors",
    formFieldInputGroup: "rounded-md",
    formFieldAction:
      "text-accent hover:text-accent/80 text-[12px] font-medium no-underline",
    formFieldErrorText: "text-[11.5px] text-red-500 mt-1.5",
    formFieldSuccessText: "text-[11.5px] text-emerald-600 mt-1.5",
    formFieldHintText: "text-[11.5px] text-muted-foreground mt-1.5",
    formButtonPrimary:
      "h-10 rounded-md bg-accent text-accent-foreground text-[13px] font-medium hover:bg-accent/90 transition-colors shadow-none disabled:opacity-60 disabled:cursor-not-allowed",
    formButtonReset:
      "h-10 rounded-md border border-border bg-background text-foreground text-[13px] font-medium hover:bg-muted-foreground/5 transition-colors",
    formResendCodeLink: "text-accent text-[13px] font-medium",
    otpCodeFieldInput:
      "h-12 w-10 rounded-md border border-border bg-surface-elevated text-foreground text-center text-base font-medium focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground/40 transition-colors",
    footerAction: "pt-4",
    footerActionLink: "text-accent hover:text-accent/80 text-[13px] font-medium",
    footerActionText: "text-muted-foreground text-[13px]",
    identityPreviewText: "text-[13px] text-foreground",
    identityPreviewEditButton: "text-accent text-[13px] font-medium",
    alert:
      "rounded-md border border-red-500/20 bg-red-500/5 text-red-500 text-[12.5px] p-3",
    alertText: "text-[12.5px]",
    alertIcon: "h-4 w-4 text-red-500",
    verificationLinkStatusIcon__success: "fill-emerald-600",
    formFieldSuccess: "border-emerald-500/30",
    alternativeMethodsBlockButton:
      "h-10 rounded-md border border-border bg-background hover:bg-muted-foreground/5 text-foreground text-[13px] font-medium transition-colors",
    phoneInputBox: "rounded-md",
  },
  layout: {
    socialButtonsPlacement: "top",
    showOptionalFields: false,
  },
};
