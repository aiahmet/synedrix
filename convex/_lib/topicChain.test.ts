import { describe, it, expect, vi } from "vitest";
import { resolveTopicChain, resolveTopicChains } from "./topicChain";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mockSubject(
  id: string,
  slug = "math",
  title = "Mathematics",
): Doc<"subjects"> {
  return {
    _id: id as Id<"subjects">,
    _creationTime: 0,
    title,
    slug,
    description: `Description of ${title}`,
    color: "blue",
    icon: slug,
  };
}

function mockChapter(
  id: string,
  subjectId: string,
  slug = "algebra",
  title = "Algebra",
  order = 1,
): Doc<"chapters"> {
  return {
    _id: id as Id<"chapters">,
    _creationTime: 0,
    subjectId: subjectId as Id<"subjects">,
    title,
    slug,
    order,
    description: `Description of ${title}`,
  };
}

function mockTopic(
  id: string,
  chapterId: string,
  slug = "linear-equations",
  title = "Linear Equations",
): Doc<"topics"> {
  return {
    _id: id as Id<"topics">,
    _creationTime: 0,
    chapterId: chapterId as Id<"chapters">,
    title,
    slug,
    objectives: [`Understand ${title}`],
    examRelevance: 5,
    difficulty: "EASY",
    estimatedMinutes: 30,
    gradeLevel: "10",
  };
}

/**
 * Build a minimal mock `QueryCtx` whose `db.get` returns rows from a
 * pre-seeded Map.  Unknown IDs resolve to `null`.
 */
function mockQueryCtx(seededDocs: Map<string, unknown>) {
  return {
    db: {
      get: async (id: string) => seededDocs.get(id) ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  resolveTopicChain                                                  */
/* ------------------------------------------------------------------ */

describe("resolveTopicChain", () => {
  it("returns the topic, chapter, and subject for a valid chain", async () => {
    const subject = mockSubject("sub_1");
    const chapter = mockChapter("ch_1", "sub_1");
    const topic = mockTopic("t_1", "ch_1");

    const docs = new Map<string, unknown>([
      ["t_1", topic],
      ["ch_1", chapter],
      ["sub_1", subject],
    ]);

    const ctx = mockQueryCtx(docs) as unknown as QueryCtx;
    const result = await resolveTopicChain(ctx, "t_1" as Id<"topics">);

    expect(result).not.toBeNull();
    expect(result!.topic._id).toBe("t_1");
    expect(result!.chapter._id).toBe("ch_1");
    expect(result!.subject._id).toBe("sub_1");

    // Verify the returned docs are the exact seeded objects
    expect(result!.topic).toBe(topic);
    expect(result!.chapter).toBe(chapter);
    expect(result!.subject).toBe(subject);
  });

  it("returns null when the topic does not exist", async () => {
    const docs = new Map<string, unknown>([
      ["ch_1", mockChapter("ch_1", "sub_1")],
      ["sub_1", mockSubject("sub_1")],
    ]);

    const ctx = mockQueryCtx(docs) as unknown as QueryCtx;
    const result = await resolveTopicChain(ctx, "missing_topic" as Id<"topics">);

    expect(result).toBeNull();
  });

  it("returns null when the chapter does not exist", async () => {
    const topic = mockTopic("t_1", "missing_chapter");
    const subject = mockSubject("sub_1");

    const docs = new Map<string, unknown>([
      ["t_1", topic],
      ["sub_1", subject],
    ]);

    const ctx = mockQueryCtx(docs) as unknown as QueryCtx;
    const result = await resolveTopicChain(ctx, "t_1" as Id<"topics">);

    expect(result).toBeNull();
  });

  it("returns null when the subject does not exist", async () => {
    const topic = mockTopic("t_1", "ch_1");
    const chapter = mockChapter("ch_1", "missing_subject");

    const docs = new Map<string, unknown>([
      ["t_1", topic],
      ["ch_1", chapter],
    ]);

    const ctx = mockQueryCtx(docs) as unknown as QueryCtx;
    const result = await resolveTopicChain(ctx, "t_1" as Id<"topics">);

    expect(result).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  resolveTopicChains                                                 */
/* ------------------------------------------------------------------ */

describe("resolveTopicChains", () => {
  it("returns 5 entries for 5 valid topics with chapter cache hits", async () => {
    // 2 subjects
    const subMath = mockSubject("sub_math", "math", "Mathematics");
    const subPhysics = mockSubject("sub_physics", "physics", "Physics");

    // 3 chapters (two under math, one under physics)
    const chAlgebra = mockChapter("ch_algebra", "sub_math", "algebra", "Algebra");
    const chGeometry = mockChapter("ch_geometry", "sub_math", "geometry", "Geometry");
    const chMechanics = mockChapter("ch_mechanics", "sub_physics", "mechanics", "Mechanics");

    // 5 topics — topics 1 & 2 share chAlgebra, 3 & 4 share chGeometry, 5 stands alone
    const t1 = mockTopic("t1", "ch_algebra", "linear", "Linear Equations");
    const t2 = mockTopic("t2", "ch_algebra", "quadratic", "Quadratic Equations");
    const t3 = mockTopic("t3", "ch_geometry", "angles", "Angles");
    const t4 = mockTopic("t4", "ch_geometry", "triangles", "Triangles");
    const t5 = mockTopic("t5", "ch_mechanics", "newton", "Newton's Laws");

    const docs = new Map<string, unknown>([
      ["t1", t1], ["t2", t2], ["t3", t3], ["t4", t4], ["t5", t5],
      ["ch_algebra", chAlgebra],
      ["ch_geometry", chGeometry],
      ["ch_mechanics", chMechanics],
      ["sub_math", subMath],
      ["sub_physics", subPhysics],
    ]);

    // Instrument db.get to count chapter-lookup calls
    let chapterGetCount = 0;
    const dbGet = vi.fn(async (id: string) => {
      if (id.startsWith("ch_")) chapterGetCount++;
      return docs.get(id) ?? null;
    });

    const ctx = { db: { get: dbGet } } as unknown as QueryCtx;

    const result = await resolveTopicChains(ctx, [
      "t1", "t2", "t3", "t4", "t5",
    ] as Id<"topics">[]);

    // All 5 resolved
    expect(result.size).toBe(5);
    expect(result.get("t1" as Id<"topics">)!.topic).toBe(t1);
    expect(result.get("t2" as Id<"topics">)!.topic).toBe(t2);
    expect(result.get("t3" as Id<"topics">)!.topic).toBe(t3);
    expect(result.get("t4" as Id<"topics">)!.topic).toBe(t4);
    expect(result.get("t5" as Id<"topics">)!.topic).toBe(t5);

    // Chapter cache: 5 topics span 3 distinct chapters → only 3 chapter fetches
    expect(chapterGetCount).toBe(3);

    // Total db.get calls = 5 (topics) + 3 (chapters) + 2 (subjects) = 10
    expect(dbGet).toHaveBeenCalledTimes(10);
  });

  it("returns 2 entries when 1 of 3 topics has a broken chain (missing chapter)", async () => {
    const subject = mockSubject("sub_1");
    const chapter = mockChapter("ch_1", "sub_1");

    // t3 points to a chapter that does not exist in the seed
    const t1 = mockTopic("t1", "ch_1", "a", "Topic A");
    const t2 = mockTopic("t2", "ch_1", "b", "Topic B");
    const t3 = mockTopic("t3", "missing_ch", "c", "Topic C");

    const docs = new Map<string, unknown>([
      ["t1", t1],
      ["t2", t2],
      ["t3", t3],
      ["ch_1", chapter],
      ["sub_1", subject],
    ]);

    const ctx = mockQueryCtx(docs) as unknown as QueryCtx;
    const result = await resolveTopicChains(ctx, [
      "t1", "t2", "t3",
    ] as Id<"topics">[]);

    expect(result.size).toBe(2);
    expect(result.has("t1" as Id<"topics">)).toBe(true);
    expect(result.has("t2" as Id<"topics">)).toBe(true);
    expect(result.has("t3" as Id<"topics">)).toBe(false);
  });
});
