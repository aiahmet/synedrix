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
    .index("by_topic", ["topicId"])
    .index("by_user_lastStudied", ["userId", "lastStudied"]),

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
        v.literal("canonical_baseline"),
        // Phase 3 §5.2: tutor-generated practice triggered
        // inline by a "Generate 3 quick questions" chip
        // inside the chat surface. Items generated this
        // way STILL travel through the standard
        // standard practiceSets / practiceItems /
        // practiceAttempts pipeline so they feed the
        // mastery curve without bespoke wiring — the
        // session is just tracked in
        // `inlineTutorSessions` so the runner UI can
        // anchor it in the timeline.
        v.literal("inline_tutor")
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
      v.literal("essay_analysis"),
      v.literal("translation_drill"),
      v.literal("formula_derivation"),
      v.literal("oral_recall"),
    ),
    question: v.string(),
    options: v.optional(v.array(v.string())),
    answer: v.string(),
    explanation: v.string(),
    skills: v.array(v.string()),
    order: v.number(),
    // source discriminator + source-lesson link.
    //
    // Note for future maintainers: the session-level
    // `inline_tutor` source lives on the parent
    // `practiceSets` row, NOT here. Inline-generated
    // items reuse this union for backwards-compat and
    // to keep `practiceItems.source` narrowly scoped to
    // the canonical / user_lesson / canonical_baseline
    // lineage. To find inline items, query
    // `practiceSets.source === "inline_tutor"` and join
    // through `practiceItems.practiceSetId`.
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
    wordCountTarget: v.optional(v.number()),
    sourcePhrase: v.optional(v.string()),
    startingExpression: v.optional(v.string()),
  })
    .index("by_practice_set", ["practiceSetId"])
    .index("by_practice_set_order", ["practiceSetId", "order"])
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
    .index("by_practice_item", ["practiceItemId"])
    // Phase 3 §5.2 follow-up: per-user / per-item lookup.
    // Drives the latest-attempt fetch in
    // `tutorPractice.getInlineSessionForRunner` and
    // `tutorPractice.endInlineSession` so the queries
    // stay O(1) per item instead of growing with the
    // user's full attempt history.
    .index("by_user_practice_item", ["userId", "practiceItemId"]),

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
      v.literal("SIGN_ERROR"),
      v.literal("UNIT_CONVERSION_ERROR"),
      v.literal("GRAMMAR_ERROR"),
      v.literal("VOCABULARY_ERROR"),
      v.literal("REACTION_BALANCE_ERROR"),
      v.literal("ARGUMENT_STRUCTURE_ISSUE"),
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
    /**
     * Phase 1 §3.1: optional structured content blob.
     * When the route handler produces a Zod-validated
     * `TutorResponse`, the serialised JSON is persisted
     * here so the `StructuredResponse` renderer can
     * reconstruct the section-by-section layout on
     * history re-reads. `undefined` for messages
     * written before structured output shipped.
     */
    structuredContent: v.optional(v.string()),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_clientId", ["threadId", "clientId"]),

  // Convex already returns index reads sorted by _creationTime
  // within a single index key, so the in-memory sort in
  // `listMessages` / `getThreadHistory` is unnecessary and has
  // been removed.

  /**
   * Phase 1 §3.2: per-session teaching strategy state.
   * One row per active tutor session. Updated after
   * every user → assistant turn pair by the route
   * handler via `api.tutorStrategy.recordTurn`.
   *
   * `currentStrategy` is the active teaching mode
   * (auto-switches on engagement signals).
   *
   * `socraticModeActive` (Phase 4 §6.3) is a user
   * toggle: when on, the tutor NEVER gives a direct
   * answer — it only asks guiding questions. This is
   * conceptually distinct from `currentStrategy`
   * because strategies auto-switch on engagement while
   * Socratic mode is a deliberate user preference;
   * both are stored together for one round-trip read
   * in the route handler.
   *
   * `latestChoiceResponseTimeMs` + `latestChoicePickedCorrect`
   * (Phase 4 §6.1) capture the most recent `[[choice:...]]`
   * widget click: response time from when the choice
   * became interactable to when the user clicked, and
   * whether the picked label matched the correct label.
   * Cleared after the route handler consumes them on the
   * next chat request so the same nudge never fires twice
   * in a row. `lastChoiceNudgeAt` is the timestamp the
   * last nudge block was actually injected into a prompt
   * so the route handler can suppress a duplicate nudge
   * if the next turn re-reads the same signal.
   *
   * `userEngagementScore` (0-1) is derived from
   * response length, time, and choice correctness.
   * `strategyHistory` captures previous strategies
   * and when they were switched.
   */
  teachingStrategyState: defineTable({
    sessionId: v.id("studySessions"),
    currentStrategy: v.union(
      v.literal("explaining"),
      v.literal("socratic"),
      v.literal("example_driven"),
      v.literal("quiz_mode"),
      v.literal("simplifying"),
    ),
    lastSwitchReason: v.optional(v.string()),
    userEngagementScore: v.number(),
    turnsInCurrentStrategy: v.number(),
    strategyHistory: v.array(v.object({
      strategy: v.string(),
      turns: v.number(),
      switchedAt: v.number(),
    })),
    // Phase 4 §6.3: when true, the tutor emits only
    // guiding questions, never direct answers.
    socraticModeActive: v.optional(v.boolean()),
    // Phase 4 §6.1: most-recent choice click latency /
    // outcome. Read by the route handler to inject a
    // "take your time" nudge when the user clicked
    // a choice in < 2 seconds without engaging.
    latestChoiceResponseTimeMs: v.optional(v.number()),
    latestChoicePickedCorrect: v.optional(v.boolean()),
    latestChoiceMessageId: v.optional(v.string()),
    lastChoiceNudgeAt: v.optional(v.number()),
  }).index("by_session", ["sessionId"]),

  /**
   * Phase 2 §4.2: cross-topic mistake pattern detection.
   * One row per detected pattern. When the same mistake
   * type appears across 3+ distinct topics, a pattern is
   * recorded with the set of involved topic ids and a
   * human-readable description.
   *
   * Patterns are detected by `api.tutorPatterns.detect`
   * (called from `endSession` in `convex/tutor.ts`) and
   * surfaced in the Memory panel + injected into the
   * tutor system prompt.
   *
   * `resolvedAt` is set when the user addresses the
   * pattern (e.g. the per-topic mistake count drops
   * across the flagged topics). Optional — not all
   * patterns are resolved.
   */
  mistakePatterns: defineTable({
    userId: v.id("users"),
    patternType: v.union(
      v.literal("sign_error_chain"),
      v.literal("formula_confusion"),
      v.literal("unit_conversion_gap"),
      v.literal("reading_comprehension"),
      v.literal("recurring_mistake_type"),
      v.literal("cross_topic_weakness"),
    ),
    /** The underlying mistake type (e.g. CALCULATION_MISTAKE). */
    mistakeType: v.string(),
    /** The distinct topic ids where this pattern was observed. */
    topicIds: v.array(v.id("topics")),
    topicCount: v.number(),
    description: v.string(),
    detectedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

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
    mode: v.optional(
      v.union(
        v.literal("sequential"),
        v.literal("timed"),
        v.literal("retry_wrong"),
        v.literal("exam_simulation"),
      )
    ),
    timeLimitSec: v.optional(v.number()),
    topicIds: v.optional(v.array(v.id("topics"))),
    currentRound: v.optional(v.number()),
    wrongItemIds: v.optional(v.array(v.id("practiceItems"))),
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
  }).index("by_user", ["userId"]),

  /**
   * inlineTutorSessions — Phase 3 §5.2.
   *
   * One row per inline practice session the student
   * triggers from the tutor chat surface (`Generate 3
   * quick questions`). The actual practice items LIVE in
   * the standard `practiceSets` / `practiceItems` /
   * `practiceAttempts` tables (flagged with
   * `source === "inline_tutor"`); this table only tracks
   * the SESSION metadata + the timeline anchor so the
   * InlinePractice tile renders in the right gap in the
   * chat history.
   *
   * `anchorMessageId` is the tutor message id the
   * session is anchored to — the MessageList sandwich
   * renders the tile AFTER that message.
   *
   * `completedAt` is set when all items are answered;
   * `overallScore` is the 0..1 mean score across items
   * and `grade` is the German Gymnasium 1-6 letter
   * derived from it.
   *
   * Per-item grading state is held in `practiceAttempts`
   * rows joined through `practiceItemId` →
   * `practiceItems.practiceSetId === session.practiceSetId`.
   */
  inlineTutorSessions: defineTable({
    threadId: v.id("tutorThreads"),
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
    practiceSetId: v.id("practiceSets"),
    /**
     * The tutor message id the session is anchored to.
     * The MessageList renders the InlinePractice tile
     * AFTER this message in the timeline. Stored as a
     * `v.string()` (not `v.id("tutorMessages")`) so we
     * can decouple the anchor from any future
     * data-model change to the messages table.
     */
    anchorMessageId: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    overallScore: v.optional(v.number()),
    grade: v.optional(
      v.union(
        v.literal("1"),
        v.literal("2"),
        v.literal("3"),
        v.literal("4"),
        v.literal("5"),
        v.literal("6")
      )
    ),
  })
    .index("by_thread_started", ["threadId", "startedAt"]),
});
