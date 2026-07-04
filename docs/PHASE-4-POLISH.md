# Phase 4: Polish

> **Scope:** Rich text editor, keyboard shortcuts, caching hardening, mobile refinement, import/export, testing.
>
> **Prerequisite:** Phase 3 complete (all features built and functional).
>
> **Theme:** This phase turns a functional app into a polished, production-ready product. No new features — just making everything better.
>
> **Status on `main`:** **Not yet implemented.** There is no rich-text notes editor, no command palette, no keyboard shortcuts beyond the textarea Enter-to-send, no test suite (the `npm run test` script is not configured), and no PostHog/Sentry observability. The mobile layout is responsive at the page level (sidebar + main grid collapse gracefully) but there is no dedicated mobile navigation bar. Caching is **not** used: Convex's reactive queries are the source of truth, so `"use cache"` / `cacheTag` are not in play. Treat the entire doc as a forward-looking spec.

---

## Table of Contents

- [Stage 4.1: Notes Editor](#stage-41-notes-editor)
- [Stage 4.2: Keyboard Shortcuts](#stage-42-keyboard-shortcuts)
- [Stage 4.3: Caching Hardening](#stage-43-caching-hardening)
- [Stage 4.4: Mobile Refinement](#stage-44-mobile-refinement)
- [Stage 4.5: Testing Suite](#stage-45-testing-suite)
- [Stage 4.6: Observability](#stage-46-observability)
- [Verification](#verification)

---

## Stage 4.1: Notes Editor

> Replace the plain text notes with a rich text editor using TipTap (lightweight, extensible, good with React).

### Dependency

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link
```

### What To Build

#### `src/features/topics/NoteEditor.tsx`

Full rich text editor component for creating and editing notes.

```tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/src/components/ui/Button";
import { Bold, Italic, Underline as UnderlineIcon, List, Link as LinkIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface NoteEditorProps {
  noteId?: Id<"notes">;
  topicId?: Id<"topics">;
  initialContent?: string;
  onSave?: () => void;
}

export function NoteEditor({ noteId, topicId, initialContent, onSave }: NoteEditorProps) {
  const createNote = useMutation(api.curriculum.createNote);
  const updateNote = useMutation(api.curriculum.updateNote);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: initialContent ?? "<p>Start writing...</p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-2",
      },
    },
  });

  const handleSave = async () => {
    if (!editor) return;
    const content = editor.getHTML();

    if (noteId) {
      await updateNote({ noteId, content });
    } else if (topicId) {
      await createNote({ topicId, title: "Untitled Note", content });
    }

    onSave?.();
  };

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded p-1 hover:bg-surface-alt ${editor.isActive("bold") ? "bg-surface-alt" : ""}`}
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded p-1 hover:bg-surface-alt ${editor.isActive("italic") ? "bg-surface-alt" : ""}`}
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded p-1 hover:bg-surface-alt ${editor.isActive("underline") ? "bg-surface-alt" : ""}`}
        >
          <UnderlineIcon size={16} />
        </button>
        <span className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded p-1 hover:bg-surface-alt ${editor.isActive("bulletList") ? "bg-surface-alt" : ""}`}
        >
          <List size={16} />
        </button>
      </div>
      <EditorContent editor={editor} />
      <div className="flex justify-end border-t border-border p-2">
        <Button size="sm" onClick={handleSave}>
          Save Note
        </Button>
      </div>
    </div>
  );
}
```

#### `convex/notes.ts`

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listNotesByTopic = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("notes")
      .withIndex("by_topic", (q) => q.eq("topicId", args.topicId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
  },
});

export const createNote = mutation({
  args: {
    topicId: v.optional(v.id("topics")),
    title: v.string(),
    content: v.string(),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("notes", {
      userId: user._id,
      ...args,
    });
  },
});

export const updateNote = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { noteId, ...fields } = args;
    await ctx.db.patch(noteId, fields);
  },
});

export const deleteNote = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.noteId);
  },
});
```

### What NOT to Build in Stage 4.1

- Do NOT add image uploads to notes — attachments are out of scope for v1 polish.
- Do NOT add real-time collaborative editing — single user.
- Do NOT add markdown shortcuts — TipTap handles formatting via toolbar.

---

## Stage 4.2: Keyboard Shortcuts

> Add system-wide keyboard shortcuts for common actions using a Zustand-driven command palette.

### What To Build

#### `src/hooks/useKeyboardShortcuts.ts`

```ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Shortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta ? e.metaKey : true;
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : true;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (metaMatch && ctrlMatch && shiftMatch && keyMatch) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
```

#### `src/components/layout/CommandPalette.tsx`

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Brain, Clock, Calendar, Plus } from "lucide-react";
import { Dialog } from "@/src/components/ui/Dialog";

const commands = [
  { id: "dashboard", label: "Go to Dashboard", icon: Search, action: "/dashboard" },
  { id: "subjects", label: "Go to Subjects", icon: BookOpen, action: "/subjects" },
  { id: "tutor", label: "Open AI Tutor", icon: Brain, action: "/tutor" },
  { id: "review", label: "Open Review", icon: Clock, action: "/review" },
  { id: "planner", label: "Open Planner", icon: Calendar, action: "/planner" },
  { id: "focus", label: "Start Focus Session", icon: Plus, action: "/focus" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const filtered = query
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Commands">
      <div className="relative">
        <Search className="absolute left-3 top-3 text-muted" size={18} />
        <input
          ref={inputRef}
          className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          placeholder="Search commands..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="mt-4 space-y-1">
        {filtered.map((cmd) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.id}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-alt transition-colors"
              onClick={() => {
                router.push(cmd.action);
                setOpen(false);
              }}
            >
              <Icon size={18} className="text-muted" />
              <span>{cmd.label}</span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
```

#### Integrate into App Shell

Add `CommandPalette` to `app/(app)/layout.tsx`:

```tsx
import { CommandPalette } from "@/src/components/layout/CommandPalette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // ... existing auth check
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
```

### Default Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+K` | Open command palette |
| `Cmd+1` | Go to Dashboard |
| `Cmd+2` | Go to Subjects |
| `Cmd+3` | Open AI Tutor |
| `Cmd+4` | Open Review |
| `Cmd+M` | Start focus mode |
| `Escape` | Close panel / cancel |
| `?` | Show shortcuts help |

### What NOT to Build in Stage 4.2

- Do NOT make shortcuts configurable — hardcoded is fine for v1.
- Do NOT add a "shortcuts help modal" beyond the `?` key binding.

---

## Stage 4.3: Caching Hardening

> Next.js 16 uses explicit caching. Apply it correctly to the dashboard and data-heavy pages.

### What To Build

#### Add `"use cache"` to Key Pages

**`app/(app)/dashboard/page.tsx`** — Cache for 5 minutes, invalidate on practice submission.

```tsx
import { cacheTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  "use cache";

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  cacheTag(`dashboard-${userId}`);

  return (
    // component JSX unchanged
  );
}
```

**`app/(app)/subjects/[subjectSlug]/page.tsx`** — Cache for 1 hour (curriculum data changes rarely).

```tsx
import { cacheLife } from "next/cache";

export default async function SubjectHubPage() {
  "use cache";
  cacheLife("hours");

  // ...
}
```

#### Invalidation on Practice Submit

Add cache tag invalidation to practice submission flow. Create a Server Action:

```ts
// src/actions/submitPractice.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { cacheTag } from "next/cache";

export async function submitPractice(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // ... save practice attempt via Convex mutation

  cacheTag(`dashboard-${userId}`);
}
```

#### Cache Tag Strategy

| Tag Pattern | When to Invalidate | Cache Duration |
|---|---|---|
| `dashboard-${userId}` | Practice submit, session end, goal update | 5 minutes |
| `subject-${slug}` | Curriculum update (manual) | 1 hour |
| `topic-${slug}` | Topic progress update | 5 minutes |
| `review-${userId}` | Flashcard review, mistake log | 1 minute |

### What NOT to Build in Stage 4.3

- Do NOT implement ISR (Incremental Static Regeneration) — this is not a content site.
- Do NOT add Redis or external caching — Convex handles server caching.
- Do NOT add stale-while-revalidate patterns — cache tags are sufficient.

---

## Stage 4.4: Mobile Refinement

> Make the app usable on tablets and phones. The target is "functional on mobile, great on desktop."

### What To Build

#### Responsive Sidebar

Update `src/components/layout/Sidebar.tsx` to auto-collapse on small screens:

```tsx
import { useEffect } from "react";
import { useUIStore } from "@/src/stores/uiStore";

// Inside Sidebar component
const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

useEffect(() => {
  if (isMobile) {
    setSidebarCollapsed(true);
  }
}, []);
```

#### Mobile Navigation

Add a bottom navigation bar for mobile viewports:

```tsx
// src/components/layout/MobileNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Brain, Clock, Calendar } from "lucide-react";
import { cn } from "@/src/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/subjects", label: "Learn", icon: BookOpen },
  { href: "/tutor", label: "Tutor", icon: Brain },
  { href: "/review", label: "Review", icon: Clock },
  { href: "/planner", label: "Plan", icon: Calendar },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background md:hidden z-40">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs",
                isActive ? "text-accent" : "text-muted"
              )}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

#### Responsive Layout Updates

- `app/(app)/layout.tsx` — Add bottom padding on mobile for the nav bar
- Dashboard grid — Switch from 3-column to single-column on mobile
- Topic page — Stack tabs vertically on small screens
- Practice runner — Full-width inputs on mobile

#### Touch Target Sizing

- All interactive elements must be at least 44x44px (Apple HIG standard)
- Add `min-h-[44px]` to buttons, links, and form controls

### What NOT to Build in Stage 4.4

- Do NOT build a separate mobile app (React Native) — web responsive only.
- Do NOT add swipe gestures — touch interactions stay within browser defaults.
- Do NOT optimize for foldable or dual-screen devices.

---

## Stage 4.5: Testing Suite

> Add tests for critical paths. Tests should verify behavior, not implementation details.

### Configuration

#### `vitest.config.ts` (root)

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "convex/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

#### `src/test/setup.ts`

```ts
import "@testing-library/jest-dom";
```

### What To Build

#### Unit Tests

**`src/lib/utils/format.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { formatMinutes, formatPercent, formatRelativeTime } from "./format";

describe("formatMinutes", () => {
  it("formats minutes under 60", () => {
    expect(formatMinutes(45)).toBe("45m");
  });

  it("formats exact hours", () => {
    expect(formatMinutes(120)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
  });
});

describe("formatPercent", () => {
  it("rounds to integer percentage", () => {
    expect(formatPercent(0.756)).toBe("76%");
  });
});

describe("formatRelativeTime", () => {
  it('returns "just now" for recent timestamps', () => {
    expect(formatRelativeTime(Date.now() - 1000)).toBe("just now");
  });

  it("returns minutes for recent times", () => {
    expect(formatRelativeTime(Date.now() - 120000)).toBe("2m ago");
  });
});
```

**`src/lib/review/scheduleReview.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { calculateSM2 } from "./scheduleReview";

describe("calculateSM2", () => {
  it("resets on quality < 3", () => {
    const result = calculateSM2({
      quality: 2,
      repetition: 5,
      previousInterval: 10,
      previousEase: 2.5,
    });

    expect(result.repetition).toBe(0);
    expect(result.interval).toBe(0);
  });

  it("sets interval to 1 day for first successful review", () => {
    const result = calculateSM2({
      quality: 4,
      repetition: 0,
      previousInterval: 0,
      previousEase: 2.5,
    });

    expect(result.repetition).toBe(1);
    expect(result.interval).toBe(1);
  });

  it("sets interval to 6 days for second successful review", () => {
    const result = calculateSM2({
      quality: 4,
      repetition: 1,
      previousInterval: 1,
      previousEase: 2.5,
    });

    expect(result.repetition).toBe(2);
    expect(result.interval).toBe(6);
  });

  it("increases interval on good reviews", () => {
    const result = calculateSM2({
      quality: 5,
      repetition: 2,
      previousInterval: 6,
      previousEase: 2.5,
    });

    expect(result.interval).toBeGreaterThan(6);
    expect(result.ease).toBeGreaterThan(2.5);
  });

  it("never reduces ease below 1.3", () => {
    const result = calculateSM2({
      quality: 0,
      repetition: 0,
      previousInterval: 0,
      previousEase: 1.3,
    });

    expect(result.ease).toBeGreaterThanOrEqual(1.3);
  });
});
```

**`src/lib/analytics/detectWeakTopics.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { rankWeakTopics } from "./detectWeakTopics";
import type { Id } from "@/convex/_generated/dataModel";

const mockId = "mock-id" as unknown as Id<"topics">;

describe("rankWeakTopics", () => {
  it("returns empty array when no topics have issues", () => {
    const result = rankWeakTopics([
      {
        topicId: mockId,
        topicTitle: "Algebra",
        subjectTitle: "Math",
        subjectSlug: "math",
        mastery: 0.9,
        confidence: 0.8,
        lastStudied: Date.now() - 86400000,
        mistakeCount: 0,
      },
    ]);

    expect(result).toHaveLength(0);
  });

  it("flags low mastery topics", () => {
    const result = rankWeakTopics([
      {
        topicId: mockId,
        topicTitle: "Calculus",
        subjectTitle: "Math",
        subjectSlug: "math",
        mastery: 0.2,
        confidence: 0.3,
        lastStudied: Date.now() - 86400000,
        mistakeCount: 5,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe("high");
    expect(result[0].reasons).toContain("Low mastery");
  });

  it("sorts high priority first", () => {
    const high = {
      topicId: mockId,
      topicTitle: "Hard Topic",
      subjectTitle: "Math",
      subjectSlug: "math",
      mastery: 0.2,
      confidence: 0.3,
      lastStudied: Date.now(),
      mistakeCount: 5,
    };

    const low = {
      topicId: mockId,
      topicTitle: "Easy Topic",
      subjectTitle: "Math",
      subjectSlug: "math",
      mastery: 0.55,
      confidence: 0.6,
      lastStudied: Date.now() - 86400000 * 20,
      mistakeCount: 1,
    };

    const result = rankWeakTopics([low, high]);
    expect(result[0].priority).toBe("high");
    expect(result[1].priority).toBe("medium");
  });
});
```

#### Integration Tests

**`src/lib/analytics/getDashboardInsights.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { deriveInsights } from "./getDashboardInsights";

describe("deriveInsights", () => {
  it("warns about many weak topics", () => {
    const insights = deriveInsights(5, 0, 0, 200);
    expect(insights.some((i) => i.type === "warning")).toBe(true);
  });

  it("celebrates streaks", () => {
    const insights = deriveInsights(0, 0, 7, 300);
    expect(insights.some((i) => i.type === "success" && i.message.includes("7-day streak"))).toBe(true);
  });

  it("encourages first session", () => {
    const insights = deriveInsights(0, 0, 0, 0);
    expect(insights.some((i) => i.message.includes("streak"))).toBe(true);
  });

  it("reports due reviews", () => {
    const insights = deriveInsights(0, 15, 3, 200);
    expect(insights.some((i) => i.type === "info" && i.message.includes("reviews"))).toBe(true);
  });
});
```

#### E2E Tests (Playwright)

**`e2e/auth.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("redirects unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});
```

**`e2e/dashboard.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("dashboard loads for authenticated user", async ({ page }) => {
  // Requires setting up Clerk test user
  // See: https://clerk.com/docs/testing/playwright
  await page.goto("/dashboard");
  await expect(page.locator("h1")).toContainText("Dashboard");
});
```

### Package Script Updates

Add these to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage"
  }
}
```

### What NOT to Build in Stage 4.5

- Do NOT test AI outputs (they're non-deterministic).
- Do NOT test Convex schema validation — Convex handles that internally.
- Do NOT write snapshot tests for components — they break too easily.
- Do NOT test individual UI primitives (Button, Card) — test composed features instead.

---

## Stage 4.6: Observability

> Add PostHog for product analytics and Sentry for error tracking. These are passive — they should never block the app.

### Dependencies

```bash
npm install posthog-js @posthog/nextjs @sentry/nextjs
```

### What To Build

#### PostHog Setup

**`src/lib/analytics/posthog.ts`**

```ts
"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    capture_pageview: false, // Let Next.js handle pageviews
  });
}

export { PostHogProvider };
```

**`app/providers.tsx`** — Create a shared providers wrapper:

```tsx
"use client";

import { ReactNode } from "react";
import { PostHogProvider } from "@/src/lib/analytics/posthog";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider>
      {children}
    </PostHogProvider>
  );
}
```

Update root layout to include Providers.

#### Sentry Setup

Follow the Sentry Next.js SDK setup wizard:

```bash
npx @sentry/wizard@latest -i nextjs
```

This will create `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`.

### What NOT to Build in Stage 4.6

- Do NOT add custom event tracking beyond PostHog's automatic pageviews.
- Do NOT add custom performance monitoring — Sentry handles errors.
- Do NOT add logging that could capture PII (personally identifiable information).

---

## Future Considerations (Not in v1)

These features are explicitly deferred past Phase 4:

- **Multi-language UI** (i18n) — The app content is multilingual, but the UI is English-only for v1
- **Social features** — No sharing, friends, leaderboards
- **Offline mode** — No PWA offline support yet
- **Desktop app** — No Electron/Tauri wrapper
- **Third-party integrations** — No Anki export, no Notion sync
- **Collaborative studying** — Single user only
- **Parent/observer dashboard** — Roles are modeled but unused
- **Admin panel** — No admin features

---

## Verification

After completing Phase 4, verify:

1. `npm run typecheck` passes with zero errors
2. `npm run lint` passes with zero errors
3. `npm run test` passes with all tests green
4. Notes editor loads and saves content on topic pages
5. `Cmd+K` opens the command palette
6. `Cmd+1` through `Cmd+4` navigate to main sections
7. Dashboard page includes `"use cache"` directive
8. App is usable on mobile viewports (sidebar auto-collapses, bottom nav visible)
9. PostHog captures pageviews (check PostHog dashboard)
10. Sentry captures uncaught errors (test by throwing a deliberate error in dev)
