import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    .index("by_subject_order", ["subjectId", "order"]),

  topics: defineTable({
    chapterId: v.id("chapters"),
    title: v.string(),
    slug: v.string(),
    objectives: v.array(v.string()),
    examRelevance: v.number(),
    difficulty: v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
    estimatedMinutes: v.optional(v.number()),
    gradeLevel: v.optional(v.string()),
  })
    .index("by_chapter", ["chapterId"])
    .index("by_slug", ["slug"]),

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
  }).index("by_topic_depth", ["topicId", "depth"]),

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
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "_creationTime"]),

  goals: defineTable({
    userId: v.id("users"),
    subjectId: v.optional(v.id("subjects")),
    title: v.string(),
    type: v.union(v.literal("daily"), v.literal("weekly")),
    targetCount: v.optional(v.number()),
    completedCount: v.optional(v.number()),
    deadline: v.optional(v.number()),
  }).index("by_user_type", ["userId", "type"]),

  practiceSets: defineTable({
    topicId: v.id("topics"),
    title: v.string(),
    difficulty: v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
    generatedById: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_topic", ["topicId"]),

  practiceItems: defineTable({
    practiceSetId: v.id("practiceSets"),
    type: v.union(
      v.literal("mcq"),
      v.literal("short_answer"),
      v.literal("step_problem"),
      v.literal("fill_blank"),
    ),
    question: v.string(),
    options: v.optional(v.array(v.string())),
    answer: v.string(),
    explanation: v.string(),
    skills: v.array(v.string()),
    order: v.number(),
  }).index("by_practice_set", ["practiceSetId"]),

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
    attemptedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_practice_item", ["practiceItemId"]),

  flashcardDecks: defineTable({
    topicId: v.id("topics"),
    title: v.string(),
    description: v.optional(v.string()),
    generatedById: v.optional(v.id("users")),
  }).index("by_topic", ["topicId"]),

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
    .index("by_user_review", ["userId", "reviewAt"]),

  tutorThreads: defineTable({
    userId: v.id("users"),
    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),
    title: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  tutorMessages: defineTable({
    threadId: v.id("tutorThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    quotedBlock: v.optional(v.string()),
  }).index("by_thread", ["threadId"]),

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
    .index("by_user", ["userId"])
    .index("by_task", ["task"]),

  attachments: defineTable({
    userId: v.id("users"),
    noteId: v.optional(v.id("notes")),
    topicId: v.optional(v.id("topics")),
    storageId: v.id("_storage"),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
  }).index("by_user", ["userId"]),
});
