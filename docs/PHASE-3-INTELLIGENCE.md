# Phase 3: Intelligence

> **Scope:** Planner, focus mode, weak-topic detection, analytics dashboard, personalization engine.
>
> **Prerequisite:** Phase 2 complete (core learning loop works end-to-end).
>
> **Theme:** This phase makes the app proactive. Instead of the student asking "what should I study?", the app tells them.
>
> **Status on `main`:** **Not yet implemented.** The dashboards in `app/(app)/dashboard/` and the cockpit components in `components/dashboard/` are *primitive* visualizations (per-subject mastery, due-today, streak). There is no planner, no focus mode, no weak-topic detection, no separate `/analytics` page, and no personalization engine. The `goal` and `studySession` tables exist in the schema and are partially written by `convex/studySessions.ts`, but no planner UI reads them. Treat everything in this doc as a forward-looking spec.

---

## Table of Contents

- [Stage 3.1: Planner System](#stage-31-planner-system)
- [Stage 3.2: Focus Mode](#stage-32-focus-mode)
- [Stage 3.3: Analytics Convex Functions](#stage-33-analytics-convex-functions)
- [Stage 3.4: Analytics Dashboard UI](#stage-34-analytics-dashboard-ui)
- [Stage 3.5: Weak-Topic Detection](#stage-35-weak-topic-detection)
- [Stage 3.6: Personalization Engine](#stage-36-personalization-engine)
- [Verification](#verification)

---

## Stage 3.1: Planner System

> The planner connects goals to actual sessions. Students set daily/weekly goals, log study sessions, and the app tracks progress.

### What To Build

#### `convex/planner.ts`

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// --- Goals ---

export const listGoals = query({
  args: {
    type: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    let query = ctx.db
      .query("goals")
      .withIndex("by_user_type", (q) => q.eq("userId", user._id));

    if (args.type) {
      query = query.filter((q) => q.eq(q.field("type"), args.type));
    }

    return await query.collect();
  },
});

export const createGoal = mutation({
  args: {
    subjectId: v.optional(v.id("subjects")),
    title: v.string(),
    type: v.union(v.literal("daily"), v.literal("weekly")),
    targetCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("goals", {
      userId: user._id,
      ...args,
      completedCount: 0,
    });
  },
});

export const updateGoalProgress = mutation({
  args: {
    goalId: v.id("goals"),
    completedCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.goalId, {
      completedCount: args.completedCount,
    });
  },
});

export const deleteGoal = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.goalId);
  },
});

// --- Study Sessions ---

export const listRecentSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("studySessions")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const createSession = mutation({
  args: {
    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),
    intention: v.optional(v.string()),
    durationSec: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("studySessions", {
      userId: user._id,
      ...args,
      completedAt: Date.now(),
    });
  },
});

export const getWeeklyStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const weekAgo = Date.now() - 7 * 86400000;

    const sessions = await ctx.db
      .query("studySessions")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .filter((q) => q.gte(q.field("_creationTime"), weekAgo))
      .collect();

    const totalMinutes = Math.round(
      sessions.reduce((sum, s) => sum + s.durationSec, 0) / 60
    );

    // Group by day
    const byDay: Record<string, number> = {};
    for (const session of sessions) {
      const day = new Date(session._creationTime).toISOString().split("T")[0];
      byDay[day] = (byDay[day] || 0) + Math.round(session.durationSec / 60);
    }

    return {
      totalSessions: sessions.length,
      totalMinutes,
      byDay,
      streak: calculateStreak(sessions),
    };
  },
});

function calculateStreak(sessions: { _creationTime: number }[]): number {
  if (sessions.length === 0) return 0;

  const days = [
    ...new Set(
      sessions.map((s) => new Date(s._creationTime).toISOString().split("T")[0])
    ),
  ].sort((a, b) => b.localeCompare(a));

  let streak = 0;
  const today = new Date().toISOString().split("T")[0];

  for (let i = 0; i < days.length; i++) {
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    const expectedDay = expected.toISOString().split("T")[0];
    if (days[i] === expectedDay) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
```

#### `src/features/planner/GoalCard.tsx`

```tsx
"use client";

import { Card } from "@/src/components/ui/Card";
import { Badge } from "@/src/components/ui/Badge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import type { Id } from "@/convex/_generated/dataModel";

interface GoalCardProps {
  goal: {
    _id: Id<"goals">;
    title: string;
    type: "daily" | "weekly";
    targetCount?: number;
    completedCount?: number;
    subjectId?: Id<"subjects">;
  };
}

export function GoalCard({ goal }: GoalCardProps) {
  const progress = goal.targetCount
    ? ((goal.completedCount ?? 0) / goal.targetCount) * 100
    : 0;

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{goal.title}</h3>
        <Badge variant={goal.type === "daily" ? "info" : "default"}>
          {goal.type}
        </Badge>
      </div>
      <ProgressBar value={progress} />
      <p className="text-sm text-muted">
        {goal.completedCount ?? 0} / {goal.targetCount ?? "—"} completed
      </p>
    </Card>
  );
}
```

#### `app/(app)/planner/page.tsx`

Planner page — lists goals, recent sessions, weekly overview.

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PlannerTimeline } from "@/src/features/planner/PlannerTimeline";

export default async function PlannerPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Planner</h1>
      <PlannerTimeline />
    </div>
  );
}
```

#### `src/features/planner/PlannerTimeline.tsx`

Timeline of upcoming study sessions, today's goals, and a weekly calendar view.

### What NOT to Build in Stage 3.1

- Do NOT add push notifications or reminders.
- Do NOT build session templates — just manual session logging.
- Do NOT build the auto-generated next-step feature.

---

## Stage 3.2: Focus Mode

> Focus mode strips the app down to a single-task environment. No sidebar, no navigation — just the current goal and a timer.

### What To Build

#### `src/features/planner/FocusMode.tsx`

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import type { Id } from "@/convex/_generated/dataModel";

interface FocusModeProps {
  subjectId?: Id<"subjects">;
  topicId?: Id<"topics">;
  intention?: string;
}

export function FocusMode({ subjectId, topicId, intention }: FocusModeProps) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [reflection, setReflection] = useState("");
  const createSession = useMutation(api.planner.createSession);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const endSession = useCallback(async () => {
    setIsRunning(false);
    await createSession({
      subjectId,
      topicId,
      intention: intention ?? "",
      durationSec: seconds,
    });
    router.back();
  }, [seconds, subjectId, topicId, intention, createSession, router]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-8 max-w-md">
        {intention && (
          <p className="text-lg text-muted">{intention}</p>
        )}

        <div className="text-6xl font-mono font-bold tracking-wider">
          {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>

        {!isRunning ? (
          <Button size="lg" onClick={() => setIsRunning(true)}>
            Start Session
          </Button>
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <textarea
                className="w-full resize-none bg-transparent text-sm outline-none"
                placeholder="What are you working on? (optional)"
                rows={2}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
            </Card>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={endSession}>
                End Session
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### `app/(app)/focus/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { FocusMode } from "@/src/features/planner/FocusMode";

export default async function FocusPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <FocusMode />;
}
```

### What NOT to Build in Stage 3.2

- Do NOT add ambient sounds or background music.
- Do NOT add pomodoro-style break reminders — focus mode is open-ended.
- Do NOT add session notes auto-save.

---

## Stage 3.3: Analytics Convex Functions

### What To Build

#### `convex/analytics.ts`

```ts
import { v } from "convex/values";
import { query } from "./_generated/server";

export const getSubjectMasterySummary = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const subjects = await ctx.db.query("subjects").collect();
    const allProgress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const result = [];

    for (const subject of subjects) {
      const chapters = await ctx.db
        .query("chapters")
        .withIndex("by_subject", (q) => q.eq("subjectId", subject._id))
        .collect();

      let topicCount = 0;
      let masteredCount = 0;

      for (const chapter of chapters) {
        const topics = await ctx.db
          .query("topics")
          .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
          .collect();

        for (const topic of topics) {
          topicCount++;
          const progress = allProgress.find((p) => p.topicId === topic._id);
          if (progress && progress.mastery >= 0.8) {
            masteredCount++;
          }
        }
      }

      result.push({
        subjectId: subject._id,
        subjectTitle: subject.title,
        subjectSlug: subject.slug,
        subjectColor: subject.color,
        topicCount,
        masteredCount,
        mastery: topicCount > 0 ? masteredCount / topicCount : 0,
      });
    }

    return result;
  },
});

export const getWeakTopics = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const progress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.lt(q.field("mastery"), 0.6))
      .order("desc")
      .take(args.limit ?? 10);

    const result = [];
    for (const p of progress) {
      const topic = await ctx.db.get(p.topicId);
      if (topic) {
        const chapter = await ctx.db.get(topic.chapterId);
        const subject = chapter
          ? await ctx.db.get(chapter.subjectId)
          : null;

        result.push({
          topic,
          progress: p,
          chapterTitle: chapter?.title,
          subjectTitle: subject?.title,
          subjectSlug: subject?.slug,
        });
      }
    }

    return result;
  },
});

export const getMistakePatterns = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const mistakes = await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const byType: Record<string, number> = {};
    for (const m of mistakes) {
      byType[m.mistakeType] = (byType[m.mistakeType] || 0) + 1;
    }

    const byTopic: Record<string, { count: number; topicTitle: string }> = {};
    for (const m of mistakes) {
      if (m.topicId) {
        const topic = await ctx.db.get(m.topicId);
        if (topic) {
          if (!byTopic[m.topicId]) {
            byTopic[m.topicId] = { count: 0, topicTitle: topic.title };
          }
          byTopic[m.topicId].count++;
        }
      }
    }

    return {
      totalMistakes: mistakes.length,
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      byTopic: Object.entries(byTopic).map(([topicId, data]) => ({
        topicId,
        ...data,
      })),
    };
  },
});

export const getReviewStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const now = Date.now();

    const dueCards = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user_due", (q) => q.eq("userId", user._id))
      .filter((q) => q.lte(q.field("dueAt"), now))
      .count();

    const totalCards = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .count();

    const dueMistakes = await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user_review", (q) => q.eq("userId", user._id))
      .filter((q) => q.lte(q.field("reviewAt"), now))
      .count();

    return {
      dueCards,
      totalCards,
      dueMistakes,
      reviewCompletionRate: totalCards > 0
        ? (totalCards - dueCards) / totalCards
        : 0,
    };
  },
});
```

#### `src/lib/analytics/getDashboardInsights.ts`

```ts
// Derives insights from raw analytics data for display on the dashboard.
// This runs on the server and is consumed by dashboard components.

export interface Insight {
  type: "warning" | "success" | "info" | "tip";
  message: string;
}

export function deriveInsights(
  weakTopics: number,
  reviewDue: number,
  streak: number,
  weeklyMinutes: number
): Insight[] {
  const insights: Insight[] = [];

  if (weakTopics > 3) {
    insights.push({
      type: "warning",
      message: `You have ${weakTopics} weak topics that need attention.`,
    });
  }

  if (reviewDue > 10) {
    insights.push({
      type: "info",
      message: `You have ${reviewDue} reviews due. A quick session can clear these.`,
    });
  }

  if (streak >= 5) {
    insights.push({
      type: "success",
      message: `${streak}-day streak! Keep it going.`,
    });
  } else if (streak === 0) {
    insights.push({
      type: "tip",
      message: "Start a study session to begin your streak.",
    });
  }

  if (weeklyMinutes < 120) {
    insights.push({
      type: "info",
      message: "You're on track for light week. Aim for 2+ hours for solid progress.",
    });
  }

  return insights;
}
```

### What NOT to Build in Stage 3.3

- Do NOT build predictive analytics or ML models — v1 uses rule-based insights only.
- Do NOT cache analytics query results — Phase 4.
- Do NOT build export functionality.

---

## Stage 3.4: Analytics Dashboard UI

### What To Build

#### `src/features/analytics/MasteryChart.tsx`

Recharts-based bar or radar chart showing mastery per subject.

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/src/components/ui/Card";
import { Skeleton } from "@/src/components/ui/Skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function MasteryChart() {
  const data = useQuery(api.analytics.getSubjectMasterySummary);

  if (!data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const chartData = data.map((s) => ({
    name: s.subjectTitle,
    mastery: Math.round(s.mastery * 100),
    color: s.subjectColor ?? "#0d9488",
  }));

  return (
    <Card className="p-4">
      <h3 className="font-medium mb-4">Subject Mastery</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="mastery" fill="#0d9488" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
```

#### `src/features/analytics/ConsistencyChart.tsx`

Line chart of study minutes per day over 4 weeks.

#### `src/features/analytics/MistakePatterns.tsx`

Shows mistake breakdown by type (pie or bar chart) and by topic.

#### `app/(app)/analytics/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MasteryChart } from "@/src/features/analytics/MasteryChart";
import { ConsistencyChart } from "@/src/features/analytics/ConsistencyChart";
import { MistakePatterns } from "@/src/features/analytics/MistakePatterns";

export default async function AnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MasteryChart />
        <ConsistencyChart />
      </div>

      <MistakePatterns />
    </div>
  );
}
```

### What NOT to Build in Stage 3.4

- Do NOT add date range pickers — show default views only.
- Do NOT add data export (CSV/PDF) — Phase 4.
- Do NOT build downloadable reports.

---

## Stage 3.5: Weak-Topic Detection

> This uses existing analytics data to proactively identify topics the student is struggling with.

### What To Build

#### `src/lib/analytics/detectWeakTopics.ts`

```ts
import type { Id } from "@/convex/_generated/dataModel";

export interface WeakTopicSignal {
  topicId: Id<"topics">;
  topicTitle: string;
  subjectTitle: string;
  subjectSlug: string;
  mastery: number;
  confidence: number;
  daysSinceStudy: number;
  mistakeCount: number;
  reasons: string[];
  priority: "high" | "medium" | "low";
}

export function rankWeakTopics(
  topics: {
    topicId: Id<"topics">;
    topicTitle: string;
    subjectTitle: string;
    subjectSlug: string;
    mastery: number;
    confidence: number;
    lastStudied?: number;
    mistakeCount: number;
  }[]
): WeakTopicSignal[] {
  const now = Date.now();

  return topics
    .map((t) => {
      const daysSinceStudy = t.lastStudied
        ? Math.floor((now - t.lastStudied) / 86400000)
        : 999;

      const reasons: string[] = [];
      if (t.mastery < 0.4) reasons.push("Low mastery");
      if (t.confidence < t.mastery) reasons.push("Overconfidence gap");
      if (daysSinceStudy > 14) reasons.push("Not studied in 2+ weeks");
      if (t.mistakeCount > 3) reasons.push(`${t.mistakeCount} mistakes logged`);

      const priority: WeakTopicSignal["priority"] =
        (t.mastery < 0.3 || (t.mastery < 0.5 && daysSinceStudy > 7))
          ? "high"
          : (t.mastery < 0.6 || daysSinceStudy > 14)
            ? "medium"
            : "low";

      return {
        ...t,
        daysSinceStudy,
        reasons,
        priority,
      };
    })
    .filter((t) => t.reasons.length > 0)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return a.mastery - b.mastery;
    });
}
```

### What NOT to Build in Stage 3.5

- Do NOT build "predicted mastery decay" ML models.
- Do NOT add email or push notifications for weak topics.
- Do NOT add automatic scheduling of weak-topic review sessions.

---

## Stage 3.6: Personalization Engine

> Uses all available signals to recommend what the student should do next.

### What To Build

#### `src/lib/analytics/getNextRecommendation.ts`

```ts
import type { WeakTopicSignal } from "./detectWeakTopics";

export interface Recommendation {
  type: "review" | "study_new" | "practice" | "rescue_plan";
  subjectSlug: string;
  topicSlug?: string;
  title: string;
  description: string;
  reason: string;
}

export function getNextRecommendation(
  weakTopics: WeakTopicSignal[],
  dueReviews: number,
  recentSessionTopics: string[],
  hasUnfinishedTopics: boolean
): Recommendation {
  // Priority 1: Due reviews (if any are overdue)
  if (dueReviews > 0) {
    return {
      type: "review",
      subjectSlug: "",
      title: "Clear your review queue",
      description: `${dueReviews} items due for review`,
      reason: "Spaced repetition works best when you stay on schedule.",
    };
  }

  // Priority 2: High-priority weak topics
  const highPriority = weakTopics.filter((t) => t.priority === "high");
  if (highPriority.length > 0) {
    const topic = highPriority[0];
    return {
      type: "study_new",
      subjectSlug: topic.subjectSlug,
      topicSlug: topic.topicTitle.toLowerCase().replace(/\s+/g, "-"),
      title: `Review: ${topic.topicTitle}`,
      description: `Mastery is at ${Math.round(topic.mastery * 100)}%. ${topic.reasons[0] ?? ""}`,
      reason: "This topic needs immediate attention to prevent falling behind.",
    };
  }

  // Priority 3: Continue recent topics
  if (recentSessionTopics.length > 0) {
    return {
      type: "practice",
      subjectSlug: "",
      title: "Continue where you left off",
      description: "You were studying recently. Keep the momentum going.",
      reason: "Regular short sessions beat long irregular ones.",
    };
  }

  // Priority 4: Start something new
  if (hasUnfinishedTopics) {
    return {
      type: "study_new",
      subjectSlug: "",
      title: "Start a new topic",
      description: "Pick a subject and begin the next chapter.",
      reason: "Progress is built one topic at a time.",
    };
  }

  // Default
  return {
    type: "practice",
    subjectSlug: "",
    title: "Generate a practice session",
    description: "Test your knowledge with AI-generated questions.",
    reason: "Practice reveals gaps you didn't know you had.",
  };
}
```

### What NOT to Build in Stage 3.6

- Do NOT build A/B testing or recommendation tracking.
- Do NOT build collaborative filtering ("other students also studied...").
- Do NOT build adaptive difficulty adjustment.

---

## Verification

After completing Phase 3, verify:

1. `npm run typecheck` passes with zero errors
2. `npm run lint` passes with zero errors
3. Goals can be created and tracked on the planner page
4. Study sessions are logged with duration
5. Focus mode works as a full-screen timer
6. Weekly stats show streak, total minutes, and daily breakdown
7. Mastery chart renders with per-subject data
8. Weak topics are identified and ranked correctly
9. AI recommendation generates a relevant next-step suggestion
10. Mistake patterns view groups mistakes by type and topic
