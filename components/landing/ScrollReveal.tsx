"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  once?: boolean;
  amount?: number;
}

const directionMap = {
  up: { y: 24 },
  down: { y: -24 },
  left: { x: 24 },
  right: { x: -24 },
} as const;

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up",
  duration = 0.65,
  once = true,
  amount = 0.15,
}: ScrollRevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...directionMap[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export function ScrollRevealStagger({
  children,
  className,
  baseDelay = 0,
  staggerMs = 70,
  direction = "up",
  duration = 0.6,
}: {
  children: ReactNode[];
  className?: string;
  baseDelay?: number;
  staggerMs?: number;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
}) {
  const reduce = useReducedMotion();

  if (!Array.isArray(children)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      {children.map((child, i) => (
        <ScrollReveal
          key={i}
          delay={reduce ? 0 : baseDelay + (i * staggerMs) / 1000}
          direction={direction}
          duration={duration}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}
