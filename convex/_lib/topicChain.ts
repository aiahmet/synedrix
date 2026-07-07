import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Resolve the topic → chapter → subject chain for a single topic.
 *
 * Returns `null` if the topic does not exist, or if any link in the chain
 * is missing (broken foreign key).
 */
export async function resolveTopicChain(
  ctx: QueryCtx,
  topicId: Id<"topics">,
): Promise<{
  topic: Doc<"topics">;
  chapter: Doc<"chapters">;
  subject: Doc<"subjects">;
} | null> {
  const topic = await ctx.db.get(topicId);
  if (!topic) return null;

  const chapter = await ctx.db.get(topic.chapterId);
  if (!chapter) return null;

  const subject = await ctx.db.get(chapter.subjectId);
  if (!subject) return null;

  return { topic, chapter, subject };
}

/**
 * Batch-resolve the topic → chapter → subject chain for many topics.
 *
 * Deduplicates chapter and subject fetches using a Map cache so that
 * topics sharing the same chapter or subjects sharing the same parent
 * only produce one DB read each.
 *
 * Entries with a broken chain (missing topic, chapter, or subject) are
 * silently omitted from the returned Map.
 */
export async function resolveTopicChains(
  ctx: QueryCtx,
  topicIds: readonly Id<"topics">[],
): Promise<Map<Id<"topics">, {
  topic: Doc<"topics">;
  chapter: Doc<"chapters">;
  subject: Doc<"subjects">;
}>> {
  // 1. Fetch all topics in parallel.
  const topics = await Promise.all(
    topicIds.map((id) => ctx.db.get(id)),
  );

  // 2. Collect unique chapter IDs, caching resolved chapters.
  const chapterCache = new Map<Id<"chapters">, Doc<"chapters"> | null>();
  const uniqueChapterIds = new Set<Id<"chapters">>();

  for (const t of topics) {
    if (t) uniqueChapterIds.add(t.chapterId);
  }

  // 3. Fetch all unique chapters in parallel.
  const uniqueChapterIdArr = [...uniqueChapterIds];
  const chapterResults = await Promise.all(
    uniqueChapterIdArr.map((id) => ctx.db.get(id)),
  );
  for (let i = 0; i < chapterResults.length; i++) {
    const ch = chapterResults[i];
    chapterCache.set(uniqueChapterIdArr[i], ch ?? null);
  }

  // 4. Collect unique subject IDs, caching resolved subjects.
  const subjectCache = new Map<Id<"subjects">, Doc<"subjects"> | null>();
  const uniqueSubjectIds = new Set<Id<"subjects">>();

  for (const ch of chapterCache.values()) {
    if (ch) uniqueSubjectIds.add(ch.subjectId);
  }

  // 5. Fetch all unique subjects in parallel.
  const uniqueSubjectIdArr = [...uniqueSubjectIds];
  const subjectResults = await Promise.all(
    uniqueSubjectIdArr.map((id) => ctx.db.get(id)),
  );
  for (let i = 0; i < subjectResults.length; i++) {
    const sub = subjectResults[i];
    subjectCache.set(uniqueSubjectIdArr[i], sub ?? null);
  }

  // 6. Assemble the result Map, omitting broken chains.
  const result = new Map<Id<"topics">, {
    topic: Doc<"topics">;
    chapter: Doc<"chapters">;
    subject: Doc<"subjects">;
  }>();

  for (const t of topics) {
    if (!t) continue;
    const chapter = chapterCache.get(t.chapterId);
    if (!chapter) continue;
    const subject = subjectCache.get(chapter.subjectId);
    if (!subject) continue;
    result.set(t._id, { topic: t, chapter, subject });
  }

  return result;
}
