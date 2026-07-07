import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface SectionProps {
  readonly id?: string;
  readonly ariaLabelledBy?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly containerClassName?: string;
  readonly as?: "section" | "article" | "aside" | "header" | "footer";
}

/**
 * `Section` establishes the shared vertical rhythm for the marketing page.
 *
 * Why a wrapper instead of inline classes:
 *   1. Single source of truth for section padding.
 *   2. Forces an id + aria-labelledby pairing that screen readers can use.
 *   3. Keeps JSX clean when composing the page out of many sections.
 *
 * The container inside always uses the same max width and horizontal
 * padding, eliminating the drift that builds up across reuse.
 */
export function Section({
  id,
  ariaLabelledBy,
  children,
  className,
  containerClassName,
  as = "section",
}: SectionProps) {
  const Tag = as;
  return (
    <Tag
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={cn("relative w-full", className)}
    >
      <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", containerClassName)}>
        {children}
      </div>
    </Tag>
  );
}

interface SectionHeadingProps {
  readonly eyebrow?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly align?: "start" | "center";
  readonly titleId?: string;
}

/**
 * `SectionHeading` provides a single, semantically correct H2 plus
 * optional supporting copy. The eyebrow is intentionally restricted:
 * we use a maximum of one eyebrow per three sections so the rhythm
 * stays editorial rather than templated.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "start",
  titleId,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" && "items-center text-center")}>
      {eyebrow}
      <h2
        id={titleId}
        className="text-[clamp(1.95rem,2.4vw+0.5rem,2.75rem)] font-semibold leading-[1.04] tracking-[-0.024em] text-foreground"
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]",
            align === "center" && "mx-auto"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
