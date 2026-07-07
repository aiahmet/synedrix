"use client";

import { Sun, Moon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { theme, resolved, toggle } = useTheme();
  const isDark = resolved === "dark";

  const label =
    theme === "system"
      ? "Following system theme. Click to use light mode."
      : isDark
        ? "Dark mode. Click to follow system theme."
        : "Light mode. Click to switch to dark mode.";

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      onClick={toggle}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted-foreground/5 hover:text-foreground"
      transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
    >
      <motion.span
        initial={false}
        animate={{
          scale: isDark ? 0 : 1,
          opacity: isDark ? 0 : 1,
          rotate: isDark ? -90 : 0,
        }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="absolute"
      >
        <Sun className="h-4 w-4" weight="duotone" />
      </motion.span>
      <motion.span
        initial={false}
        animate={{
          scale: isDark ? 1 : 0,
          opacity: isDark ? 1 : 0,
          rotate: isDark ? 0 : 90,
        }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="absolute"
      >
        <Moon className="h-4 w-4" weight="duotone" />
      </motion.span>
    </motion.button>
  );
}
