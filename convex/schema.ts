import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * `subjects` — the canonical curriculum rows.
   *
   * The `color` and `icon` fields are deliberately typed
   * as `v.optional(v.string())` (not closed unions).
   * Convex unions add friction in the seed for no real
   * type-safety benefit when the contract is a small
   * fixed set of slugs. The contract is enforced by
   * JSDoc instead — see `convex/subjects.ts` for the
   * full "Subject UX contract" block.
   *
   * Contract:
   *   `color` ∈ { "math" | "physics" | "chemistry" |
   *                "french" | "german" | "english" } (the
   *                six canonical subjects). Optionally
   *                prefixed with `subject-` (both forms
   *                accepted by `resolveColorVar`).
   *   `icon`  matches the subject SLUG (e.g. `"math"`).
   *                `SUBJECT_ICON_MAP` in
   *                `components/landing/icons.ts` keys on
   *                this slug. Legacy rows with Phosphor
   *                component names (`"MathOperations"`,
   *                etc.) are migrated in place by
   *                `api.subjects.migrateIconSlugs`.
   *
   * When adding a 7th subject: add the slug to
   * `SUBJECT_ICON_MAP` AND to the canonical seed tree
   * (`convex/seed.ts`). The two must match.
   */
  subjects: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  }).index("by_slug", ["slug"]),

  chapters: defineTable({
    subjectId: v.id("subjects"),
    title: v.string(),
    slug: v.string(),
    order: v.number(),
    description: v.optional(v.string()),
  })
    .index("by_subject", ["subjectId"])
    .index("by_subject_order", ["subjectId", "order"])
    // Compound lookup for the chapter drilldown. Avoids a
    // `collect() + in-memory find()` over all chapters in a
    // subject.
    .index("by_subject_slug", ["subjectId", "slug"]),

  /**
   * `topics` extends the canonical curriculum to also hold
   * student-created topics. Decision D1 (locked in
   * docs/USER-TOPIC-LESSON-PLAN.md §2): extend `topics`
   * with a `source` discriminator + `ownerId` rather than
   * a parallel table. AGENTS.md requires exactly one name
   * per concept everywhere — `Topic` is `Topic`.
   *
   * `source` and `ownerId` are optional so the canonical
   * seed rows (and any pre-existing user rows) migrate
   * without a script. Reading code treats
   * `row.source ?? "canonical"` as the canonical default.
   */
  topics: defineTable({
    chapterId: v.id("chapters"),
    title: v.string(),
    slug: v.string(),
    objectives: v.array(v.string()),
    examRelevance: v.number(),
    difficulty: v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
    estimatedMinutes: v.optional(v.number()),
    gradeLevel: v.optional(v.string()),
    // NEW: discriminator + ownership for student-created topics.
    source: v.optional(
      v.union(v.literal("canonical"), v.literal("user"))
    ),
    ownerId: v.optional(v.id("users")),
  })
    .index("by_chapter", ["chapterId"])
    .index("by_slug", ["slug"])
    // NEW: per-owner listing for the /my-topics dashboard
    // tile. The compound (ownerId, source) index is what the
    // `getChapterBySlug` drilldown uses so canonical rows are
    // never re-scanned for user rows.
    .index("by_owner", ["ownerId"])
    .index("by_owner_source", ["ownerId", "source"]),

  topicPrerequisites: defineTable({
    topicId: v.id("topics"),
    prerequisiteTopicId: v.id("topics"),
  })
    .index("by_topic", ["topicId"])
    .index("by_prerequisite", ["prerequisiteTopicId"]),

  lessonBlocks: defineTable({
    topicId: v.id("topics"),
    title: v.string(),
    content: v.string(),
    depth: v.union(v.literal("simple"), v.literal("standard"), v.literal("rigorous")),
    order: v.number(),
    /**
     * 2–5 worked examples per block. Each walks through a real
     * problem, the setup + the solution. The renderer shows
     * these as a "Worked examples" panel below the prose.
     */
    workedExamples: v.optional(
      v.array(
        v.object({
          setup: v.string(),
          solution: v.string(),
          skill: v.string(),
        })
      )
    ),
    /**
     * 1–4 pre-seeded common mistakes per block. Merged with
     * the user's `mistakeEntries` history at read time by
     * `CommonMistakesPanel`.
     */
    commonMistakes: v.optional(
      v.array(
        v.object({
          mistake: v.string(),
          correction: v.string(),
          cause: v.string(),
        })
      )
    ),
    /**
     * 1–6 formulas per block (STEM subjects). The renderer
     * renders these with the math renderer.
     */
    formulas: v.optional(
      v.array(
        v.object({
          name: v.string(),
          expression: v.string(),
          when: v.string(),
        })
      )
    ),
    /**
     * 1–30 vocabulary terms per block (language subjects).
     * Each term is the foreign-language word paired with
     * the German (or English) definition.
     */
    vocabulary: v.optional(
      v.array(
        v.object({
          term: v.string(),
          definition: v.string(),
          gender: v.optional(v.union(
            v.literal("m"), v.literal("f"), v.literal("n")
          )),
        })
      )
    ),
  }).index("by_topic_depth", ["topicId", "depth"]),

  /**
   * User-generated lesson rows per decision D2 in the
   * plan. Parallel to `lessonBlocks`, not a superset of
   * it — a student-generated lesson is a single coherent
   * prose document with optional sections, not an
   * ordered curriculum-arc of blocks. Canonical topics
   * never have rows here; their lesson text lives in
   * `lessonBlocks`.
   *
   * IMUTABLE by versioning. `regenerateTopicLesson`
   * (convex/topics.ts) inserts a new `topicLessons` row
   * with `version = previous + 1`; the old rows stay so
   * practice runs continue to link to the version the
   * student saw when they practiced.
   */
  topicLessons: defineTable({
    topicId: v.id("topics"),
    depth: v.union(v.literal("simple"), v.literal("standard"), v.literal("rigorous")),
    // Joined sections. The structured view the lesson
    // page renders and the practice generator consumes.
    content: v.string(),
    sections: v.array(
      v.object({
        heading: v.string(),
        body: v.string(),
      })
    ),
    wordCount: v.number(),
    glossary: v.array(
      v.object({ term: v.string(), definition: v.string() })
    ),
    generatedBy: v.id("users"),
    generatedAt: v.number(),
    version: v.number(),
    model: v.string(),
    // `false` when the AI output failed Zod validation; the
    // lesson page renders a degraded view + a Regenerate CTA.
    schemaValid: v.boolean(),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_version", ["topicId", "version"]),

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(
      v.literal("Student"),
      v.literal("ParentObserver"),
      v.literal("Tutor"),
      v.literal("Admin"),
    ),
    onboardingComplete: v.optional(v.boolean()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  /**
   * tutorProfiles.
   *
   * One row per `users` row: the 11-question onboarding
   * profile that drives personalization across the AI tutor,
   * the curriculum map, and the cockpit priorities.
   *
   * Decision (locked): keep this SEPARATE from `users`, per
   * AGENTS.md's strict separation rule. The `users` table is
   * identity + auth; the tutor profile is the per-app
   * configuration. Splitting them keeps the webhook path
   * (which only writes `users`) small and keeps a future
   * "edit your preferences" surface scoped to one table.
   *
   * All onboarding question answers are stored verbatim so the
   * AI tutor prompt builder can render precise instructions.
   * The `preferredExplanationStyle`, `feedbackStyle`,
   * `learningPreference`, and `communicationStyle` are
   * stored as closed unions so we can render them with named
   * behavior. The free-form fields
   * (`curriculumName`, `curriculumFreeform`, `primaryGoal`,
   * `biggestObstacle`) are short strings — short enough to
   * fit a sentence in the tutor greeting.
   *
   * `completedAt` is the timestamp the user clicked
   * "Start Learning" — used by the dashboard to compute
   * "Days since onboarding" and to disambiguate from rows
   * created by re-onboarding (out of scope here, but the
   * field is forward-compatible).
   */
  tutorProfiles: defineTable({
    userId: v.id("users"),
    // 1-13 numeric grade. 13 = university.
    grade: v.number(),
    // Closed enum for the common cases; "other" widens to a
    // freeform string in `curriculumFreeform` so we never
    // crash on a neglected curriculum.
    curriculum: v.union(
      v.literal("german_gymnasium"),
      v.literal("ib"),
      v.literal("a_level"),
      v.literal("ap"),
      v.literal("other")
    ),
    curriculumName: v.string(), // canonical display name
    curriculumFreeform: v.optional(v.string()),
    // Subjects the tutor focuses on (and that the user is
    // enrolled in by the end of onboarding). The Derived
    // `subjects` map in onboarding.ts is the single source
    // of truth for which slugs map to which ids.
    enrolledSubjectIds: v.array(v.id("subjects")),
    // Subset of `enrolledSubjectIds` the user picked as
    // their weakest. Capped at 3 in the UI; enforced
    // contract-side here as well so a future caller cannot
    // enumerate a larger list.
    weakestSubjectIds: v.array(v.id("subjects")),
    preferredExplanationStyle: v.union(
      v.literal("simple"),
      v.literal("standard"),
      v.literal("rigorous"),
      v.literal("examples"),
      v.literal("step_by_step"),
      v.literal("visual")
    ),
    feedbackStyle: v.union(
      v.literal("immediate"),
      v.literal("hint_first"),
      v.literal("socratic"),
      v.literal("patient")
    ),
    learningPreference: v.union(
      v.literal("practice"),
      v.literal("reading"),
      v.literal("visual"),
      v.literal("teaching"),
      v.literal("mixed")
    ),
    biggestObstacle: v.union(
      v.literal("procrastination"),
      v.literal("forgetfulness"),
      v.literal("exam_panic"),
      v.literal("no_starting_point"),
      v.literal("distraction"),
      v.literal("no_improvement")
    ),
    primaryGoal: v.union(
      v.literal("pass_classes"),
      v.literal("improve_grades"),
      v.literal("top_of_class"),
      v.literal("university_prep"),
      v.literal("master_everything")
    ),
    communicationStyle: v.union(
      v.literal("teacher"),
      v.literal("private_tutor"),
      v.literal("coach"),
      v.literal("challenge")
    ),
    completedAt: v.number(),
  }).index("by_user", ["userId"]),

  userTopicProgress: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    mastery: v.number(),
    confidence: v.number(),
    timeSpentSec: v.number(),
    lastStudied: v.optional(v.number()),
  })
    .index("by_user_topic", ["userId", "topicId"])
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"]),

  /**
   * Explicit subject enrollment. The dashboard treats a subject
   * as "enrolled" when either this row exists OR the user has any
   * progress for one of its topics, so this table is the new
   * source of truth and the userTopicProgress fallback is just
   * a migration courtesy for users who studied before the table
   * landed.
   */
  userSubjects: defineTable({
    userId: v.id("users"),
    subjectId: v.id("subjects"),
    enrolledAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_subject", ["userId", "subjectId"])
    .index("by_subject", ["subjectId"]),

  notes: defineTable({
    userId: v.id("users"),
    topicId: v.optional(v.id("topics")),
    title: v.string(),
    content: v.string(),
    pinned: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"]),

  studySessions: defineTable({
    userId: v.id("users"),
    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),
    intention: v.optional(v.string()),
    durationSec: v.number(),
    reflection: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"]),

  goals: defineTable({
    userId: v.id("users"),
    subjectId: v.optional(v.id("subjects")),
    title: v.string(),
    type: v.union(v.literal("daily"), v.literal("weekly")),
    targetCount: v.optional(v.number()),
    completedCount: v.optional(v.number()),
    deadline: v.optional(v.number()),
  }).index("by_user_type", ["userId", "type"]),

  /**
   * `practiceSets` extends the canonical pipeline with a
   * `source` discriminator + a link back to a
   * `topicLessons` row for student-generated lessons.
   * `startLessonPractice` (convex/practice.ts) writes a
   * `source: "user_lesson"` row every time the student
   * begins a practice run.
   */
  practiceSets: defineTable({
    topicId: v.id("topics"),
    title: v.string(),
    difficulty: v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
    generatedById: v.optional(v.id("users")),
    createdAt: v.number(),
    // source discriminator + source-lesson link.
    source: v.optional(
      v.union(
        v.literal("canonical"),
        v.literal("user_lesson"),
        v.literal("canonical_baseline")
      )
    ),
    sourceLessonId: v.optional(v.id("topicLessons")),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_source", ["topicId", "source"]),

  /**
   * Practice items extend the canonical discriminated
   * union with `user_text_answer` — an open-prose answer
   * for student-generated lessons.
   *
   * `source` is optional for backwards compatibility
   * with canonical rows; reading code treats
   * `row.source ?? "canonical"` as the canonical default.
   *
   * `rubric` carries the per-item grading rubric the AI
   * produced alongside the prompt (decision D5 in the
   * plan — reused `practiceAttempts` for storage, so the
   * rubric must travel with the item).
   */
  practiceItems: defineTable({
    practiceSetId: v.id("practiceSets"),
    type: v.union(
      v.literal("mcq"),
      v.literal("short_answer"),
      v.literal("step_problem"),
      v.literal("fill_blank"),
      v.literal("user_text_answer"),
      v.literal("worked_walkthrough"),
    ),
    question: v.string(),
    options: v.optional(v.array(v.string())),
    answer: v.string(),
    explanation: v.string(),
    skills: v.array(v.string()),
    order: v.number(),
    // source discriminator + source-lesson link.
    source: v.optional(
      v.union(
        v.literal("canonical"),
        v.literal("user_lesson"),
        v.literal("canonical_baseline")
      )
    ),
    sourceLessonId: v.optional(v.id("topicLessons")),
    // optional grading rubric.
    rubric: v.optional(v.array(v.string())),
  })
    .index("by_practice_set", ["practiceSetId"])
    .index("by_source_lesson", ["sourceLessonId"]),

  practiceAttempts: defineTable({
    userId: v.id("users"),
    practiceItemId: v.id("practiceItems"),
    userAnswer: v.string(),
    verdict: v.union(
      v.literal("correct"),
      v.literal("partially_correct"),
      v.literal("incorrect"),
    ),
    score: v.number(),
    feedback: v.optional(v.string()),
    // NEW: model-authored "what a strong answer would say".
    // Persisted so the results page can render it without
    // re-prompting the grader.
    betterAnswer: v.optional(v.string()),
    attemptedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_practice_item", ["practiceItemId"]),

  flashcardDecks: defineTable({
    topicId: v.id("topics"),
    title: v.string(),
    description: v.optional(v.string()),
    generatedById: v.optional(v.id("users")),
    /**
     * Source discriminator. Canonical-baseline decks are
     * pre-seeded per topic; user decks are created by the
     * student.
     */
    source: v.optional(
      v.union(
        v.literal("canonical"),
        v.literal("user"),
        v.literal("canonical_baseline")
      )
    ),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_source", ["topicId", "source"]),

  flashcards: defineTable({
    deckId: v.id("flashcardDecks"),
    front: v.string(),
    back: v.string(),
    order: v.number(),
  }).index("by_deck", ["deckId"]),

  flashcardReviews: defineTable({
    userId: v.id("users"),
    flashcardId: v.id("flashcards"),
    ease: v.number(),
    intervalDays: v.number(),
    dueAt: v.number(),
    lastResult: v.optional(
      v.union(v.literal("AGAIN"), v.literal("HARD"), v.literal("GOOD"), v.literal("EASY")),
    ),
  })
    .index("by_user_flashcard", ["userId", "flashcardId"])
    .index("by_user_due", ["userId", "dueAt"]),

  /**
   * Mistake entries are reused for lesson-practice
   * mistakes verbatim per decision D6 in the plan. The
   * six-variants union on `mistakeType` already covers the
   * kinds of prose-answer mistakes the grader emits.
   * `practiceAttemptId` is the join key.
   */
  mistakeEntries: defineTable({
    userId: v.id("users"),
    topicId: v.optional(v.id("topics")),
    practiceAttemptId: v.optional(v.id("practiceAttempts")),
    question: v.string(),
    userAnswer: v.string(),
    correctAnswer: v.string(),
    mistakeType: v.union(
      v.literal("CONCEPT_MISUNDERSTANDING"),
      v.literal("CALCULATION_MISTAKE"),
      v.literal("CARELESS_ERROR"),
      v.literal("FORMULA_RECALL_FAILURE"),
      v.literal("MISREAD_QUESTION"),
      v.literal("LANGUAGE_EXPRESSION_ISSUE"),
    ),
    cause: v.optional(v.string()),
    recoveryAction: v.optional(v.string()),
    reviewAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"])
    .index("by_user_review", ["userId", "reviewAt"])
    .index("by_user_topic", ["userId", "topicId"]),

  tutorThreads: defineTable({
    userId: v.id("users"),
    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),
    title: v.optional(v.string()),
    // When the user last opened this thread. Unread count
    // in the history sidebar = messages whose
    // _creationTime is greater than this. `undefined`
    // means the user has never opened the thread, so all
    // messages count as unread.
    lastReadAt: v.optional(v.number()),
    // Denormalized "most recent activity" timestamp. Written
    // by `appendUserMessage`, `recordAssistantMessage`, and
    // `ensureThread` so the sidebar can sort threads without
    // a per-thread `tutorMessages` query. Existing rows
    // without this field fall back to `_creationTime`.
    lastMessageAt: v.optional(v.number()),
    // Denormalized unread assistant-message count. Written
    // by `appendUserMessage`, `recordAssistantMessage`, and
    // `markThreadRead`. Existing rows without this field
    // treat the thread as fully unread if `lastReadAt` is
    // missing, or fully read if `lastReadAt` is set.
    unreadCount: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    // Hot path: getOrCreateThread needs to find the existing
    // thread for a (user, subject, topic) tuple in O(log n).
    // Replaces the previous "query all + in-memory find()"
    // pattern.
    .index("by_user_subject", ["userId", "subjectId"]),

  tutorMessages: defineTable({
    threadId: v.id("tutorThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    quotedBlock: v.optional(v.string()),
    /**
     * Stable id from the client (the Vercel AI SDK's
     * UIMessage.id). Used as a dedupe key by
     * `appendUserMessage` so retries do not insert the
     * same user message twice. Optional for backwards
     * compatibility with messages written before the
     * field existed.
     */
    clientId: v.optional(v.string()),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_clientId", ["threadId", "clientId"]),

  // Convex already returns index reads sorted by _creationTime
  // within a single index key, so the in-memory sort in
  // `listMessages` / `getThreadHistory` is unnecessary and has
  // been removed.

  aiGenerations: defineTable({
    userId: v.id("users"),
    task: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    schemaValid: v.boolean(),
    relatedId: v.optional(v.string()),
  })
    // Hot-path reads: per-user time-ordered (cost / token
    // dashboards) and per-task analytics. Without these
    // compound indexes the dashboard's "last 30 days of
    // AI calls" widget would full-scan the table.
    .index("by_user", ["userId"])
    .index("by_task", ["task"])
    .index("by_user_task", ["userId", "task"]),

  /**
   * One row per practice run the student takes against a
   * lesson (decision D4 in the plan). Tracks run-level
   * state (`status`, `overallScore`, letter grade 1–6).
   * Per-item attempts live in `practiceAttempts`, joined
   * through `practiceItems` (via `practiceSets`).
   *
   * `lessonId` is OPTIONAL because not every practice run
   * is anchored to a `topicLessons` row: canonical-baseline
   * practice reuses the per-topic canonical practice set
   * without writing a lesson at all. Keeping the field
   * optional lets `startCanonicalPractice` write a clean
   * `undefined` instead of the previous empty-string cast
   * (`"" as Id<"topicLessons">`) that crashed
   * `ctx.db.get(run.lessonId)` inside the grader.
   *
   * User-generated-lesson practice continues to write a
   * real `lessonId`. Read-side code (grader, tutor context,
   * results page) MUST gate on `lessonId !== undefined`
   * before dereferencing it.
   */
  topicLessonPractice: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    lessonId: v.optional(v.id("topicLessons")),
    practiceSetId: v.id("practiceSets"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.union(
      v.literal("in_progress"),
      v.literal("graded"),
      v.literal("abandoned"),
    ),
    itemCount: v.number(),
    answeredCount: v.number(),
    // 0..1
    overallScore: v.optional(v.number()),
    // German Gymnasium letter grade 1–6.
    grade: v.optional(
      v.union(
        v.literal("1"),
        v.literal("2"),
        v.literal("3"),
        v.literal("4"),
        v.literal("5"),
        v.literal("6"),
      )
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_topic", ["userId", "topicId"])
    .index("by_lesson", ["lessonId"]),

  /**
   * Per-topic resources that are not depth-scoped. Each
   * topic has zero or one of each `kind`; uniqueness is
   * enforced by the (topicId, kind) compound index.
   *
   * `kind` is the discriminator: "formula_sheet" for STEM
   * subjects, "vocabulary_deck" for language subjects.
   */
  topicResources: defineTable({
    topicId: v.id("topics"),
    kind: v.union(
      v.literal("formula_sheet"),
      v.literal("vocabulary_deck"),
    ),
    contents: v.array(
      v.union(
        v.object({
          // formula_sheet shape
          name: v.string(),
          expression: v.string(),
          when: v.string(),
        }),
        v.object({
          // vocabulary_deck shape
          term: v.string(),
          definition: v.string(),
          gender: v.optional(v.union(
            v.literal("m"), v.literal("f"), v.literal("n")
          )),
          example: v.optional(v.string()),
        }),
      )
    ),
    language: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_kind", ["topicId", "kind"]),

  attachments: defineTable({
    userId: v.id("users"),
    noteId: v.optional(v.id("notes")),
    topicId: v.optional(v.id("topics")),
    storageId: v.id("_storage"),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
  }).index("by_user", ["userId"])
});
