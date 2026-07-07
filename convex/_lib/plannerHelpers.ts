import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { computeStreak } from "./streak";
import { resolveTopicChains } from "./topicChain";
import type { WeeklyStats, EnrichedGoal, EnrichedTemplate, OverdueTopic } from "./plannerTypes";

const DAY_MS = 86_400_000;

/**
 * Compute weekly statistics for a user.
 *
 * Caps: sessions ≤ 100, goals ≤ 50.
 */
export async function computeWeeklyStats(
  ctx: QueryCtx,
  userId: Id<"users">,
  now: number,
): Promise<WeeklyStats> {
  const [sessions, goals] = await Promise.all([
    ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100),
    ctx.db
      .query("goals")
      .withIndex("by_user_type", (q) => q.eq("userId", userId))
      .take(50),
  ]);

  const completedTimes = sessions
    .map((s) => s.completedAt)
    .filter((t): t is number => typeof t === "number");
  const streak = computeStreak(completedTimes, now, { timeZone: "UTC" });

  const weekAgo = now - 7 * DAY_MS;
  const weekSessions = sessions.filter(
    (s) => typeof s.completedAt === "number" && s.completedAt >= weekAgo,
  );
  const totalMinutes = Math.round(
    weekSessions.reduce((sum, s) => sum + s.durationSec, 0) / 60,
  );
  const totalSessions = weekSessions.length;

  let goalCompletionRate = 0;
  if (goals.length > 0) {
    const completed = goals.filter(
      (g) => (g.completedCount ?? 0) >= (g.targetCount ?? 1),
    );
    goalCompletionRate = Math.round((completed.length / goals.length) * 100);
  }

  return { totalMinutes, totalSessions, streakDays: streak, goalCompletionRate };
}

/**
 * Collect overdue topics (mastery < 0.85, not studied for >= 3 days).
 *
 * Caps: userTopicProgress ≤ 200.
 * Uses resolveTopicChains for batch resolution (not per-row).
 *
 * @param limit max number of overdue topics to return (applied after sort)
 */
export async function collectOverdueTopics(
  ctx: QueryCtx,
  userId: Id<"users">,
  now: number,
  limit: number,
): Promise<OverdueTopic[]> {
  const allProgress = await ctx.db
    .query("userTopicProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200);

  const candidateTopicIds: Id<"topics">[] = [];
  const progressEntries: {
    topicId: Id<"topics">;
    mastery: number;
    lastStudied: number;
    daysSince: number;
  }[] = [];

  for (const p of allProgress) {
    const ls = p.lastStudied;
    if (!ls) continue;
    const daysSince = Math.floor((now - ls) / DAY_MS);
    if (daysSince < 3) continue;
    if (p.mastery >= 0.85) continue;

    candidateTopicIds.push(p.topicId);
    progressEntries.push({
      topicId: p.topicId,
      mastery: p.mastery,
      lastStudied: ls,
      daysSince,
    });
  }

  const chains = await resolveTopicChains(ctx, candidateTopicIds);

  const overdue: OverdueTopic[] = [];

  for (const entry of progressEntries) {
    const chain = chains.get(entry.topicId);
    if (!chain) continue;
    const { topic, chapter, subject } = chain;

    overdue.push({
      id: entry.topicId,
      slug: topic.slug,
      title: topic.title,
      subjectTitle: subject.title,
      subjectSlug: subject.slug,
      subjectColor: subject.color ?? null,
      chapterSlug: chapter.slug,
      mastery: entry.mastery,
      lastStudied: entry.lastStudied,
      daysSinceStudy: entry.daysSince,
    });
  }

  overdue.sort((a, b) => (b.daysSinceStudy ?? 0) - (a.daysSinceStudy ?? 0));

  return overdue.slice(0, limit);
}

/**
 * Batch-resolve subject titles and colors for a goals array.
 *
 * Caps: subjects fetched ≤ number of unique subjectIds in goals (bounded by goals input).
 */
export async function resolveGoalSubjects(
  ctx: QueryCtx,
  goals: Doc<"goals">[],
): Promise<EnrichedGoal[]> {
  const uniqueSubjectIds = Array.from(
    new Set(
      goals
        .map((g) => g.subjectId)
        .filter((id): id is Id<"subjects"> => id !== undefined),
    ),
  );

  const subjectRows =
    uniqueSubjectIds.length > 0
      ? await Promise.all(uniqueSubjectIds.map((id) => ctx.db.get(id)))
      : [];
  const subjectMap = new Map<Id<"subjects">, Doc<"subjects">>();
  for (const s of subjectRows) {
    if (s) subjectMap.set(s._id, s);
  }

  return goals.map((g) => {
    const subject = g.subjectId ? subjectMap.get(g.subjectId) : undefined;
    return {
      id: g._id,
      title: g.title,
      type: g.type,
      targetCount: g.targetCount ?? null,
      completedCount: g.completedCount ?? 0,
      deadline: g.deadline ?? null,
      subjectTitle: subject?.title ?? null,
      subjectColor: subject?.color ?? null,
    };
  });
}

/**
 * Batch-resolve subject titles and colors for a templates array.
 *
 * Caps: subjects fetched ≤ number of unique subjectIds in templates.
 */
export async function resolveTemplateSubjects(
  ctx: QueryCtx,
  templates: Doc<"sessionTemplates">[],
): Promise<EnrichedTemplate[]> {
  const uniqueSubjectIds = Array.from(
    new Set(
      templates
        .map((t) => t.subjectId)
        .filter(
          (id): id is Id<"subjects"> => id !== undefined && id !== null,
        ),
    ),
  );

  const subjectRows =
    uniqueSubjectIds.length > 0
      ? await Promise.all(uniqueSubjectIds.map((id) => ctx.db.get(id)))
      : [];
  const subjectMap = new Map<Id<"subjects">, Doc<"subjects">>();
  for (const s of subjectRows) {
    if (s) subjectMap.set(s._id, s);
  }

  return templates.map((t) => {
    const subject = t.subjectId ? subjectMap.get(t.subjectId) : undefined;
    return {
      id: t._id,
      title: t.title,
      description: t.description ?? null,
      subjectId: t.subjectId ?? null,
      subjectTitle: subject?.title ?? null,
      subjectColor: subject?.color ?? null,
      intentionHint: t.intentionHint ?? null,
      targetMinutes: t.targetMinutes ?? null,
    };
  });
}
