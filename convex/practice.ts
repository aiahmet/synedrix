import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";
import {
  scoreToGermanGrade,
  type GermanLetterGrade,
} from "./_lib/grading";

/**
 * practice.ts.
 *
 * Lesson-scoped practice runs. The mutations below are
 * pure-persistence: route handlers (`/api/topics/practice/*`)
 * perform the AI work and invoke these mutations with the
 * model-authored structured output. This matches the
 * existing `/api/tutor/chat` orchestration pattern
 * (AGENTS.md: AI plumbing outside the Convex surface) and
 * keeps the mutations free of fetch/streamObject.
 *
 * Decision D4: one row per *run* (`topicLessonPractice`)
 * is the bankable unit. Per-item attempts and the
 * per-answer wrongness log reuse `practiceAttempts` and
 * `mistakeEntries`.
 */

const verdictArg = v.union(
  v.literal("correct"),
  v.literal("partially_correct"),
  v.literal("incorrect")
);

const gradeArg = v.union(
  v.literal("1"),
  v.literal("2"),
  v.literal("3"),
  v.literal("4"),
  v.literal("5"),
  v.literal("6")
);

const mistakeTypeArg = v.union(
  v.literal("CONCEPT_MISUNDERSTANDING"),
  v.literal("CALCULATION_MISTAKE"),
  v.literal("CARELESS_ERROR"),
  v.literal("FORMULA_RECALL_FAILURE"),
  v.literal("MISREAD_QUESTION"),
  v.literal("LANGUAGE_EXPRESSION_ISSUE")
);

const practiceItemShapeArg = v.object({
  prompt: v.string(),
  expectedAnswer: v.string(),
  skill: v.string(),
  rubric: v.array(v.string()),
});

const gradeShapeArg = v.object({
  verdict: verdictArg,
  score: v.number(),
  feedback: v.string(),
  betterAnswer: v.string(),
  mistakeType: v.union(mistakeTypeArg, v.null()),
  cause: v.union(v.string(), v.null()),
});

/**
 * startLessonPractice.
 *
 * Atomically creates a `topicLessonPractice` row +
 * a `practiceSets` row (source: "user_lesson") + N
 * `practiceItems` rows. The structured `items` list
 * comes from the AI route handler that already
 * validated it against the Zod schema.
 *
 * Validates that the lesson exists and is owned by the
 * calling user. Refuses if the lesson is canonical
 * (`source !== "user"`). Sets status = "in_progress".
 */
export const startLessonPractice = mutation({
  args: {
    lessonId: v.id("topicLessons"),
    itemCount: v.optional(v.number()),
    items: v.array(practiceItemShapeArg),
  },
  returns: v.object({
    runId: v.id("topicLessonPractice"),
    itemIds: v.array(v.id("practiceItems")),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new ConvexError("lesson_not_found");

    const topic = await ctx.db.get(lesson.topicId);
    if (!topic) throw new ConvexError("topic_not_found");
    if (topic.source !== "user" || topic.ownerId !== user._id) {
      throw new ConvexError("forbidden");
    }

    if (args.items.length === 0) {
      throw new ConvexError("practice_items_empty");
    }

    // Single practiceSets row keyed by the lesson + topic.
    const practiceSetId = await ctx.db.insert("practiceSets", {
      topicId: topic._id,
      title: `Practice — ${topic.title}`,
      difficulty: topic.difficulty,
      generatedById: user._id,
      createdAt: Date.now(),
      source: "user_lesson",
      sourceLessonId: lesson._id,
    });

    const itemIds: Array<Id<"practiceItems">> = [];
    for (let i = 0; i < args.items.length; i++) {
      const it = args.items[i];
      const id = await ctx.db.insert("practiceItems", {
        practiceSetId,
        type: "user_text_answer",
        question: it.prompt,
        answer: it.expectedAnswer,
        explanation: it.expectedAnswer, // initial; results page shows the model's "betterAnswer"
        skills: [it.skill],
        order: i,
        source: "user_lesson",
        sourceLessonId: lesson._id,
        rubric: it.rubric,
      });
      itemIds.push(id);
    }

    // Handle the resume-after-abandon path. If the user
    // already has an in_progress run against this lesson,
    // we abandon it and start fresh — `abandonLessonPractice`
    // is the explicit user-driven way to resume, this is
    // the implicit "clicked Start again" path.
    const existingInProgress = await ctx.db
      .query("topicLessonPractice")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topic._id)
      )
      .collect();
    const priorInProgress = existingInProgress.find(
      (r) => r.lessonId === lesson._id && r.status === "in_progress"
    );
    if (priorInProgress) {
      await ctx.db.patch(priorInProgress._id, { status: "abandoned" });
    }

    const runId = await ctx.db.insert("topicLessonPractice", {
      userId: user._id,
      topicId: topic._id,
      lessonId: lesson._id,
      practiceSetId,
      startedAt: Date.now(),
      status: "in_progress",
      itemCount: args.items.length,
      answeredCount: 0,
    });

    return { runId, itemIds };
  },
});

/**
 * submitAnswerAndGrade.
 *
 * Persists the student's answer, the AI's grade, and (if
 * verdict !== "correct") a `mistakeEntries` row. Increments
 * `answeredCount` on the run.
 *
 * The `grade` arg is the structured object the route
 * handler produced and validated against the Zod schema.
 * Caller guarantees: `grade.verdict === "correct"` ⇒
 * `grade.mistakeType === null && grade.cause === null`.
 *
 * On Zod failure at the route handler (§11 of the plan)
 * the caller passes a fallback grade with verdict =
 * "partially_correct", score = 0.5, etc., so the
 * attempt is always recoverable.
 */
export const submitAnswerAndGrade = mutation({
  args: {
    runId: v.id("topicLessonPractice"),
    itemId: v.id("practiceItems"),
    userAnswer: v.string(),
    grade: gradeShapeArg,
  },
  returns: v.object({
    attemptId: v.id("practiceAttempts"),
    verdict: verdictArg,
    score: v.number(),
    feedback: v.string(),
    betterAnswer: v.string(),
    mistakeEntryId: v.union(v.id("mistakeEntries"), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("run_not_found");
    if (run.userId !== user._id) throw new ConvexError("forbidden");
    if (run.status !== "in_progress") {
      throw new ConvexError("run_not_in_progress");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("item_not_found");
    if (item.practiceSetId !== run.practiceSetId) {
      throw new ConvexError("item_does_not_belong_to_run");
    }

    const trimmedAnswer = args.userAnswer.trim();
    if (trimmedAnswer.length === 0) {
      throw new ConvexError("empty_answer");
    }

    // Enforce the verdict <-> mistakeType invariant in
    // the contract surface so a future caller cannot
    // violate it. Plan §5.3 + §2 D11: a "correct"
    // verdict cannot have a tagged mistakeType or a
    // cause; otherwise the mistake-entry shape would
    // not match its semantic meaning. The route
    // handler's degraded fallback (§11) is the main
    // caller and it complies; this guard is the
    // belt-and-suspenders check at the durable
    // mutation layer.
    if (
      args.grade.verdict === "correct" &&
      (args.grade.mistakeType !== null ||
        args.grade.cause !== null)
    ) {
      throw new ConvexError("invariant_verdict_mistakeType");
    }
    if (
      args.grade.verdict !== "correct" &&
      args.grade.mistakeType === null
    ) {
      throw new ConvexError("invariant_mistakeType_required");
    }

    // Persist the attempt.
    const attemptId = await ctx.db.insert("practiceAttempts", {
      userId: user._id,
      practiceItemId: args.itemId,
      userAnswer: trimmedAnswer,
      verdict: args.grade.verdict,
      score: args.grade.score,
      feedback: args.grade.feedback,
      betterAnswer: args.grade.betterAnswer,
      attemptedAt: Date.now(),
    });

    // Write a mistake entry if the verdict warrants it.
    // The invariant check above guarantees a non-correct
    // verdict always carries a `mistakeType !== null`,
    // so the conditional below is safe to dereference.
    let mistakeEntryId: Id<"mistakeEntries"> | null = null;
    if (
      args.grade.verdict !== "correct" &&
      args.grade.mistakeType !== null
    ) {
      mistakeEntryId = await ctx.db.insert("mistakeEntries", {
        userId: user._id,
        topicId: run.topicId,
        practiceAttemptId: attemptId,
        question: item.question,
        userAnswer: trimmedAnswer,
        correctAnswer: args.grade.betterAnswer,
        mistakeType: args.grade.mistakeType,
        ...(args.grade.cause !== null && args.grade.cause.length > 0
          ? { cause: args.grade.cause }
          : {}),
      });
    }

    // Bump answeredCount on the run, clamped at itemCount
    // so a defect never inflates past the configured bound.
    const nextAnswered = Math.min(
      run.itemCount,
      run.answeredCount + 1
    );
    await ctx.db.patch(run._id, { answeredCount: nextAnswered });

    return {
      attemptId,
      verdict: args.grade.verdict,
      score: args.grade.score,
      feedback: args.grade.feedback,
      betterAnswer: args.grade.betterAnswer,
      mistakeEntryId,
    };
  },
});

/**
 * finishLessonPractice.
 *
 * Marks the run graded + computes `overallScore` (mean of
 * per-item scores from the joined `practiceAttempts`) +
 * the German 1–6 letter grade.
 *
 * Throws when `answeredCount < 1` per plan §11 ("snake
 * eye: if no answeredCount > 0, throw"). Returns `null`
 * on idempotent re-finish (run is already "graded" or
 * "abandoned").
 */
export const finishLessonPractice = mutation({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.union(
    v.object({
      runId: v.id("topicLessonPractice"),
      overallScore: v.number(),
      grade: gradeArg,
    }),
    v.null()
  ),
  handler: async (ctx, { runId }) => {
    const user = await requireUser(ctx);

    const run = await ctx.db.get(runId);
    if (!run) throw new ConvexError("run_not_found");
    if (run.userId !== user._id) throw new ConvexError("forbidden");
    if (run.status !== "in_progress") return null;

    // Pull every attempt row for this run's practiceSet
    // items, scoped to the calling user. The
    // `by_practice_item` index is per-item; we want per-
    // run so an indexed collect + in-memory join is the
    // cheapest path. N is small (5–8 items per run).
    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) =>
        q.eq("practiceSetId", run.practiceSetId)
      )
      .collect();

    const itemIds = new Set(items.map((i) => i._id));
    const allAttempts = await ctx.db
      .query("practiceAttempts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Latest attempt per item (a user could in theory
    // re-submit; pick the most recent). The `index_range`
    // we want here is per-item — to take the latest we
    // sort + slice.
    const latestPerItem = new Map<
      Id<"practiceItems">,
      { score: number; attemptedAt: number }
    >();
    for (const a of allAttempts) {
      if (!itemIds.has(a.practiceItemId)) continue;
      const existing = latestPerItem.get(a.practiceItemId);
      if (!existing || a.attemptedAt > existing.attemptedAt) {
        latestPerItem.set(a.practiceItemId, {
          score: a.score,
          attemptedAt: a.attemptedAt,
        });
      }
    }

    if (latestPerItem.size === 0) {
      throw new ConvexError("no_attempts");
    }

    // Per-item mean divided by the configured itemCount,
    // not the answeredSize — so an abandoned-mid-run state
    // still gets a meaningful grade. Plan §11 explicitly
    // says "if no answeredCount > 0, throw" — so non-zero
    // is fine, just compute mean(s) / itemCount.
    const sum = Array.from(latestPerItem.values()).reduce(
      (acc, e) => acc + e.score,
      0
    );
    const overallScore =
      run.itemCount > 0 ? sum / run.itemCount : sum / latestPerItem.size;

    const grade: GermanLetterGrade = scoreToGermanGrade(overallScore);

    await ctx.db.patch(runId, {
      status: "graded",
      completedAt: Date.now(),
      overallScore,
      grade,
    });

    return { runId, overallScore, grade };
  },
});

/**
 * abandonLessonPractice.
 *
 * Marks the run "abandoned". Intentionally does NOT
 * compute a grade; the abandoned run remains in the
 * user's history visible from the /my-topics tile.
 */
export const abandonLessonPractice = mutation({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    const user = await requireUser(ctx);
    const run = await ctx.db.get(runId);
    if (!run) throw new ConvexError("run_not_found");
    if (run.userId !== user._id) throw new ConvexError("forbidden");
    if (run.status !== "in_progress") return null;
    await ctx.db.patch(runId, {
      status: "abandoned",
      completedAt: Date.now(),
    });
    return null;
  },
});

/**
 * getLessonPracticeRun.
 *
 * Returns the run shell (status, score, grade) for the
 * /my-topics/[slug]/practice page header. Returns `null`
 * if the run does not exist or does not belong to the
 * caller.
 */
export const getLessonPracticeRun = query({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.union(
    v.object({
      id: v.id("topicLessonPractice"),
      topicId: v.id("topics"),
      // `lessonId` is OPTIONAL in the schema (canonical-
      // baseline practice has no lesson). Surface this as a
      // nullable union so callers do not have to chase
      // down the schema decision manually.
      lessonId: v.union(v.id("topicLessons"), v.null()),
      practiceSetId: v.id("practiceSets"),
      status: v.union(
        v.literal("in_progress"),
        v.literal("graded"),
        v.literal("abandoned")
      ),
      itemCount: v.number(),
      answeredCount: v.number(),
      overallScore: v.union(v.number(), v.null()),
      grade: v.union(gradeArg, v.null()),
      startedAt: v.number(),
      completedAt: v.union(v.number(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { runId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== user._id) return null;
    return {
      id: run._id,
      topicId: run.topicId,
      // Canonical-baseline runs do not anchor to a
      // `topicLessons` row. Normalise to `null` so the
      // consumer's `?? null` fallback fires uniformly.
      lessonId: run.lessonId ?? null,
      practiceSetId: run.practiceSetId,
      status: run.status,
      itemCount: run.itemCount,
      answeredCount: run.answeredCount,
      overallScore: run.overallScore ?? null,
      grade: run.grade ?? null,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
    };
  },
});

/**
 * getLatestPracticeRunForOwnedTopic.
 *
 * Topic-scoped lookup so a client component can resolve
 * the right `runId` for a topic without asking the user
 * for an opaque runId they do not have. Filters by both
 * `userId` and `topicId` via the `by_user_topic` index,
 * then returns the latest run (highest `startedAt`).
 *
 * Used by `/my-topics/[topicSlug]/practice/results` to
 * pull the freshly-graded run the user just finished.
 */
export const getLatestPracticeRunForOwnedTopic = query({
  args: { topicId: v.id("topics") },
  returns: v.union(
    v.object({
      id: v.id("topicLessonPractice"),
      status: v.union(
        v.literal("in_progress"),
        v.literal("graded"),
        v.literal("abandoned")
      ),
      itemCount: v.number(),
      answeredCount: v.number(),
      overallScore: v.union(v.number(), v.null()),
      grade: v.union(gradeArg, v.null()),
      startedAt: v.number(),
      completedAt: v.union(v.number(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { topicId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    // Ownership check before we read any runs. The
    // topic must be a user-generated topic owned by
    // this caller; canonical topics are scoped under
    // the regular practice flow, not this one.
    const topic = await ctx.db.get(topicId);
    if (!topic) return null;
    if (topic.source !== "user" || topic.ownerId !== user._id) return null;

    const runs = await ctx.db
      .query("topicLessonPractice")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topicId)
      )
      .collect();
    if (runs.length === 0) return null;
    runs.sort((a, b) => b.startedAt - a.startedAt);
    const top = runs[0];
    return {
      id: top._id,
      status: top.status,
      itemCount: top.itemCount,
      answeredCount: top.answeredCount,
      overallScore: top.overallScore ?? null,
      grade: top.grade ?? null,
      startedAt: top.startedAt,
      completedAt: top.completedAt ?? null,
    };
  },
});

/**
 * Server-side helper used by /api/topics/practice/start
 * route handler. Reads a single `topicLessons` row plus
 * a denormalized view of the parent topic + gradeLevel
 * so the AI prompt builder has the lesson content,
 * sections, and grounding inputs in one round trip.
 *
 * Auth: the calling client passes a Clerk JWT via
 * `convex.setAuth`; this query resolves `ctx.auth` to
 * confirm the caller. The ownership check fires
 * downstream inside `startLessonPractice` so a typo on
 * `lessonId` cannot create orphaned runs.
 */
export const getLessonForStart = query({
  args: { lessonId: v.id("topicLessons") },
  returns: v.union(
    v.object({
      content: v.string(),
      sections: v.array(
        v.object({ heading: v.string(), body: v.string() })
      ),
      topicTitle: v.string(),
      gradeLevel: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { lessonId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return null;
    const topic = await ctx.db.get(lesson.topicId);
    if (!topic) return null;
    // Ownership check: only the topic owner can start a
    // practice run against a user-generated lesson.
    if (topic.source !== "user" || topic.ownerId !== user._id) {
      return null;
    }
    return {
      content: lesson.content,
      sections: lesson.sections,
      topicTitle: topic.title,
      gradeLevel: topic.gradeLevel ?? null,
    };
  },
});

/**
 * Server-side helper used by /api/topics/practice/grade
 * route handler. Returns the per-item prompt, the
 * model-authored expected answer, the rubric, and the
 * lesson excerpt that grounds the question. Verifies
 * ownership of the (run, item) pair so we never grade
 * against someone else's data.
 */
export const getItemForGrading = query({
  args: {
    runId: v.id("topicLessonPractice"),
    itemId: v.id("practiceItems"),
  },
  returns: v.union(
    v.object({
      prompt: v.string(),
      expectedAnswer: v.string(),
      skill: v.string(),
      rubric: v.array(v.string()),
      lessonExcerpt: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { runId, itemId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== user._id) return null;
    const item = await ctx.db.get(itemId);
    if (!item || item.practiceSetId !== run.practiceSetId) return null;

    // `run.lessonId` is OPTIONAL in the schema (canonical-
    // baseline practice does not anchor to a lesson).
    // Grading still produces a real, useful result for
    // canonical items: we substitute the item's expected
    // answer as the lesson excerpt so the model has
    // grounding even without a `topicLessons` row to draw
    // from. The item carries its own answer key + rubric,
    // so this is a meaningful (if shorter) prompt basis.
    let excerpt: string;
    if (run.lessonId !== undefined) {
      const lesson = await ctx.db.get(run.lessonId);
      if (lesson) {
        // The excerpt the grader sees is the section whose
        // heading most closely matches the item's skill
        // tag, falling back to the joined lesson content
        // if the skill does not match any heading
        // verbatim.
        const section = lesson.sections.find((s) =>
          s.heading.toLowerCase().includes(item.skills[0]?.toLowerCase() ?? "")
        );
        excerpt = section ? section.body : lesson.content.slice(0, 1200);
      } else {
        // Orphaned run: lessonId points at a deleted row.
        // Fall through to the canonical-baseline shape.
        excerpt = item.answer.slice(0, 1200);
      }
    } else {
      excerpt = item.answer.slice(0, 1200);
    }

    return {
      prompt: item.question,
      expectedAnswer: item.answer,
      skill: item.skills[0] ?? "allgemein",
      rubric: item.rubric ?? [],
      lessonExcerpt: excerpt,
    };
  },
});

/**
 * getLessonPracticeRunItems.
 *
 * Denormalized join suitable for the practice page and
 * the results page. Returns one entry per item in the
 * run's practice set, with the latest attempt (if any),
 * the model-authored expected answer, the rubric, and
 * any mistake entry linked back to the attempt.
 */
export const getLessonPracticeRunItems = query({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.array(
    v.object({
      itemId: v.id("practiceItems"),
      order: v.number(),
      prompt: v.string(),
      expectedAnswer: v.string(),
      skill: v.string(),
      rubric: v.array(v.string()),
      attempt: v.union(
        v.object({
          attemptId: v.id("practiceAttempts"),
          userAnswer: v.string(),
          verdict: verdictArg,
          score: v.number(),
          feedback: v.string(),
          betterAnswer: v.string(),
          attemptedAt: v.number(),
        }),
        v.null()
      ),
      mistake: v.union(
        v.object({
          id: v.id("mistakeEntries"),
          mistakeType: mistakeTypeArg,
          cause: v.union(v.string(), v.null()),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx, { runId }) => {
    const user = await resolveUser(ctx);
    if (!user) return [];
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== user._id) return [];

    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) =>
        q.eq("practiceSetId", run.practiceSetId)
      )
      .collect();
    items.sort((a, b) => a.order - b.order);

    // Pull all attempts + mistakes for this user scoped
    // to the run's item ids. Same per-item latest-attempt
    // join used by `finishLessonPractice`.
    const allAttempts = await ctx.db
      .query("practiceAttempts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const itemIdSet = new Set(items.map((i) => i._id));
    const attemptByItem = new Map<
      Id<"practiceItems">,
      (typeof allAttempts)[number]
    >();
    for (const a of allAttempts) {
      if (!itemIdSet.has(a.practiceItemId)) continue;
      const existing = attemptByItem.get(a.practiceItemId);
      if (!existing || a.attemptedAt > existing.attemptedAt) {
        attemptByItem.set(a.practiceItemId, a);
      }
    }

    const allMistakes = await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const mistakeByAttempt = new Map<Id<"practiceAttempts">, (typeof allMistakes)[number]>();
    for (const m of allMistakes) {
      if (m.practiceAttemptId) mistakeByAttempt.set(m.practiceAttemptId, m);
    }

    return items.map((item) => {
      const attempt = attemptByItem.get(item._id) ?? null;
      const mistake =
        attempt && mistakeByAttempt.has(attempt._id)
          ? mistakeByAttempt.get(attempt._id)!
          : null;
      return {
        itemId: item._id,
        order: item.order,
        prompt: item.question,
        expectedAnswer: item.answer,
        skill: item.skills[0] ?? "allgemein",
        rubric: item.rubric ?? [],
        attempt: attempt
          ? {
              attemptId: attempt._id,
              userAnswer: attempt.userAnswer,
              verdict: attempt.verdict,
              score: attempt.score,
              feedback: attempt.feedback ?? "",
              betterAnswer: attempt.betterAnswer ?? item.answer,
              attemptedAt: attempt.attemptedAt,
            }
          : null,
        mistake: mistake
          ? {
              id: mistake._id,
              mistakeType: mistake.mistakeType,
              cause: mistake.cause ?? null,
            }
          : null,
      };
    });
  },
});

// ── Canonical-baseline practice ────────────────────────

/**
 * getCanonicalPracticeSet.
 *
 * Returns the canonical-baseline practice set for a topic
 * (source: "canonical_baseline"). Auth-optional.
 */
export const getCanonicalPracticeSet = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const sets = await ctx.db
      .query("practiceSets")
      .withIndex("by_topic_source", (q) =>
        q.eq("topicId", topicId).eq("source", "canonical_baseline")
      )
      .collect();
    if (sets.length === 0) return null;

    const set = sets[0];
    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) => q.eq("practiceSetId", set._id))
      .collect();
    items.sort((a, b) => a.order - b.order);

    return {
      id: set._id,
      title: set.title,
      difficulty: set.difficulty,
      itemCount: items.length,
      items: items.map((i) => ({
        id: i._id,
        type: i.type,
        question: i.question,
        options: i.options,
        answer: i.answer,
        explanation: i.explanation,
        skills: i.skills,
        order: i.order,
      })),
    };
  },
});

/**
 * startCanonicalPractice.
 *
 * Creates a `topicLessonPractice` run against the
 * canonical-baseline practice set. The canonical
 * practice set's items already exist in the database;
 * this mutation only creates the run record.
 */
export const startCanonicalPractice = mutation({
  args: { topicId: v.id("topics") },
  returns: v.object({
    runId: v.id("topicLessonPractice"),
    practiceSetId: v.id("practiceSets"),
  }),
  handler: async (ctx, { topicId }) => {
    const user = await requireUser(ctx);

    const sets = await ctx.db
      .query("practiceSets")
      .withIndex("by_topic_source", (q) =>
        q.eq("topicId", topicId).eq("source", "canonical_baseline")
      )
      .collect();
    if (sets.length === 0) throw new Error("canonical_practice_set_not_found");
    const set = sets[0];

    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) => q.eq("practiceSetId", set._id))
      .collect();

    // Abandon any previous in-progress run for this topic
    const existingRuns = await ctx.db
      .query("topicLessonPractice")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topicId)
      )
      .collect();
    for (const r of existingRuns) {
      if (r.status === "in_progress") {
        await ctx.db.patch(r._id, { status: "abandoned" });
      }
    }

    const runId = await ctx.db.insert("topicLessonPractice", {
      userId: user._id,
      topicId,
      // Canonical-baseline practice has no associated
      // `topicLessons` row — the canonical practice set
      // already bundles its own prompts + answer key, and
      // writing a synthetic "canonical" lesson would
      // duplicate data the seed already encodes in the
      // `practiceSet` and `practiceItems` rows.
      // `lessonId` is therefore intentionally `undefined`
      // (the schema declares it `v.optional`). Read-side
      // queries MUST gate on `lessonId !== undefined`
      // before dereferencing it.
      lessonId: undefined,
      practiceSetId: set._id,
      startedAt: Date.now(),
      status: "in_progress",
      itemCount: items.length,
      answeredCount: 0,
    });

    return { runId, practiceSetId: set._id };
  },
});
