"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) ?? "system";
}

/**
 * Read the resolved theme that the inline <head> script
 * already applied to the DOM. This is the source of truth
 * for the first React paint: by the time the provider
 * mounts on the client, the data-theme attribute is
 * already correct, so we never trigger a flash of
 * unstyled content.
 */
function getInitialResolved(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

function applyTheme(resolved: "light" | "dark") {
  // Idempotency guard: the inline script in <head> and this
  // effect can both try to set the theme on the same paint
  // frame. Writing the same attribute twice triggers a
  // transition-on-no-op; bail early when nothing changed.
  if (typeof document === "undefined") return;
  if (document.documentElement.getAttribute("data-theme") === resolved) {
    return;
  }
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initial React state mirrors what the inline <head>
  // script has already applied. Defaults match the SSR
  // output (light) so the first client render is
  // hydration-clean.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Hydrate from the DOM + localStorage on mount. This is
  // a legitimate mount-time setState pattern: the values
  // are not available on the server, and reading them
  // synchronously after hydration is the only way to keep
  // the React state in sync with the data-theme the inline
  // script already applied. The lint rule flags this by
  // default; the disable comment is intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = getStoredTheme();
    const initial = getInitialResolved();
    setThemeState(stored);
    setResolved(initial);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Apply the resolved theme to the DOM whenever it
  // changes. `applyTheme` is idempotent, so this is safe
  // to call on every render.
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Listen for OS theme changes. The handler updates
  // `resolved` when the user has chosen "system" so the
  // UI follows the OS preference live.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        const next = getSystemTheme();
        setResolved(next);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    const next: "light" | "dark" = t === "system" ? getSystemTheme() : t;
    setResolved(next);
    applyTheme(next);
    localStorage.setItem("theme", t);
  }, []);

  const toggle = useCallback(() => {
    const cycle: Record<Theme, Theme> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setTheme(cycle[theme]);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
