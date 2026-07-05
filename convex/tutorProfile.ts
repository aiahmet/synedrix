import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";

/**
 * dedupe.
 *
 * Internal helper: removes duplicate ids from an array while
 * preserving original order. Used by `save` to defensively
 * normalise subject lists BEFORE writing — duplicates are
 * silently filtered rather than throwing so a careless client
 * (e.g. the multi-select toggling past max-3) does not surface
 * as a misleading "Save failed" error.
 */
function dedupe<T>(xs: ReadonlyArray<T>): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

/**
 * tutorProfile.ts.
 *
 * The single backend surface for the onboarding profile.
 *
 * Per the onboarding plan (welcome -> 11 questions ->
 * Building -> personalized greeting -> /dashboard), the
 * "Building" screen triggers `save` once the user has answered
 * every required question. The mutation is atomic: it
 *
 *   1. upserts the `tutorProfiles` row,
 *   2. enrolls every subject in `enrolledSubjectIds` via the
 *      `userSubjects` table (idempotent — re-enroll is a no-op
 *      per `enroll` in `convex/subjects.ts`), and
 *   3. flips `users.onboardingComplete` to true.
 *
 * If any step fails inside the mutation, Convex rolls back
 * the entire transaction, so the user is never stranded in a
 * half-onboarded state. The client surfaces the failure to a
 * Retry CTA on the Building screen instead of restarting.
 *
 * The mutation is idempotent against double-clicks AND
 * concurrent tab loads: if `users.onboardingComplete` is
 * already true, it returns the existing profile unchanged.
 * Per the thinker's recommendation, this is the belt-and-
 * braces guard alongside the Enrollment row uniqueness.
 */

const curriculumArg = v.union(
  v.literal("german_gymnasium"),
  v.literal("ib"),
  v.literal("a_level"),
  v.literal("ap"),
  v.literal("other")
);

const explanationStyleArg = v.union(
  v.literal("simple"),
  v.literal("standard"),
  v.literal("rigorous"),
  v.literal("examples"),
  v.literal("step_by_step"),
  v.literal("visual")
);

const feedbackStyleArg = v.union(
  v.literal("immediate"),
  v.literal("hint_first"),
  v.literal("socratic"),
  v.literal("patient")
);

const learningPreferenceArg = v.union(
  v.literal("practice"),
  v.literal("reading"),
  v.literal("visual"),
  v.literal("teaching"),
  v.literal("mixed")
);

const biggestObstacleArg = v.union(
  v.literal("procrastination"),
  v.literal("forgetfulness"),
  v.literal("exam_panic"),
  v.literal("no_starting_point"),
  v.literal("distraction"),
  v.literal("no_improvement")
);

const primaryGoalArg = v.union(
  v.literal("pass_classes"),
  v.literal("improve_grades"),
  v.literal("top_of_class"),
  v.literal("university_prep"),
  v.literal("master_everything")
);

const communicationStyleArg = v.union(
  v.literal("teacher"),
  v.literal("private_tutor"),
  v.literal("coach"),
  v.literal("challenge")
);

/**
 * save.
 *
 * Atomic onboarding finalize. Validates the inputs at the
 * schema boundary, validates that every subject id exists
 * before we write, then writes the profile + enrolls +
 * patches onboardingComplete. Returns the new profile id
 * so the client can confirm the write landed.
 *
 * Idempotent: a profile row exists for this user OR
 * `users.onboardingComplete` is true, returns the existing
 * row's id without re-running validation failures (a
 * successful prior save can be safely re-saved with the
 * same payload). Validation is hoisted above the
 * idempotency check so ANY caller — including a brand-new
 * insert — sees the same gate, and the enrollment loop is
 * extracted into a helper that runs on both the insert and
 * patch paths so a partial-failure retry (where the
 * profile row landed but the enrollment rows did not)
 * cannot leave the user with an orphaned profile.
 */
export const save = mutation({
  args: {
    grade: v.number(),
    curriculum: curriculumArg,
    curriculumName: v.string(),
    curriculumFreeform: v.optional(v.string()),
    enrolledSubjectIds: v.array(v.id("subjects")),
    weakestSubjectIds: v.array(v.id("subjects")),
    preferredExplanationStyle: explanationStyleArg,
    feedbackStyle: feedbackStyleArg,
    learningPreference: learningPreferenceArg,
    biggestObstacle: biggestObstacleArg,
    primaryGoal: primaryGoalArg,
    communicationStyle: communicationStyleArg,
  },
  returns: v.id("tutorProfiles"),
  handler: async (ctx, args): Promise<Id<"tutorProfiles">> => {
    const user = await requireUser(ctx);

    // ----- Validation (runs on every call, including the
    // patch path). The previous implementation only ran
    // this on the insert path; a hand-crafted client could
    // surgically corrupt the profile by re-saving with
    // `enrolledSubjectIds: []` after the row existed. -----
    if (!Number.isFinite(args.grade) || args.grade < 1 || args.grade > 13) {
      throw new ConvexError("invalid_grade");
    }
    if (args.curriculum === "other") {
      if (
        !args.curriculumFreeform ||
        args.curriculumFreeform.trim().length === 0
      ) {
        throw new ConvexError("curriculum_freeform_required");
      }
    }
    if (args.enrolledSubjectIds.length === 0) {
      throw new ConvexError("at_least_one_subject_required");
    }
    if (args.weakestSubjectIds.length > 3) {
      throw new ConvexError("max_three_weak_subjects");
    }
    // Weakest must be a subset of enrolled. Enforce server-side
    // so a hand-built client cannot smuggle a non-enrolled
    // subject into the dashboard's "focus" stack.
    for (const ws of args.weakestSubjectIds) {
      if (!args.enrolledSubjectIds.includes(ws)) {
        throw new ConvexError("weakest_must_be_enrolled");
      }
    }
    // Validate every subject id resolves. Fail loud before
    // the write so the user sees "Save failed" instead of a
    // half-applied profile.
    const subjectRows = await Promise.all(
      args.enrolledSubjectIds.map((id) => ctx.db.get(id))
    );
    if (subjectRows.some((row) => row === null)) {
      throw new ConvexError("subject_not_found");
    }

    // ----- Enrollment helper. Idempotent — re-enroll is a
    // no-op via the by_user_subject index. Runs on BOTH the
    // insert and patch paths so a partial-failure retry
    // completes the enrollment rows that the original
    // insert crashed before writing. Without this guard, a
    // user whose first save crashed between the profile
    // insert and the enrollment loop would land on the
    // patch path with an orphaned profile and zero
    // enrollments. -----
    const now = Date.now();
    const dedupedEnrolled = dedupe(args.enrolledSubjectIds);
    async function ensureEnrollments() {
      for (const subjectId of dedupedEnrolled) {
        const existing = await ctx.db
          .query("userSubjects")
          .withIndex("by_user_subject", (q) =>
            q.eq("userId", user._id).eq("subjectId", subjectId)
          )
          .first();
        if (existing) continue;
        await ctx.db.insert("userSubjects", {
          userId: user._id,
          subjectId,
          enrolledAt: now,
        });
      }
    }

    const dedupedWeakest = dedupe(args.weakestSubjectIds).slice(0, 3);
    const patchFields = {
      grade: Math.floor(args.grade),
      curriculum: args.curriculum,
      curriculumName: args.curriculumName,
      ...(args.curriculum === "other" && args.curriculumFreeform
        ? { curriculumFreeform: args.curriculumFreeform.trim() }
        : {}),
      enrolledSubjectIds: dedupedEnrolled,
      weakestSubjectIds: dedupedWeakest,
      preferredExplanationStyle: args.preferredExplanationStyle,
      feedbackStyle: args.feedbackStyle,
      learningPreference: args.learningPreference,
      biggestObstacle: args.biggestObstacle,
      primaryGoal: args.primaryGoal,
      communicationStyle: args.communicationStyle,
      completedAt: now,
    };

    // ----- Idempotency guard (race-safe): ALWAYS look up
    // an existing tutorProfiles row for this user before
    // doing anything else. Two tabs racing on Continue
    // both pass auth, both see `onboardingComplete ===
    // false`, both reach this branch. Without the
    // lookup-first check both would `db.insert` a new
    // row, leaving orphaned dead data and the dashboard
    // reading the second row by `_creationTime`. Looking
    // up FIRST turns the race into an ordered serial write
    // — the second mutation patches in place instead of
    // inserting. -----
    const existingProfile = await ctx.db
      .query("tutorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    let profileId: Id<"tutorProfiles">;
    if (existingProfile) {
      // Patch in place. Enrollments still run so a
      // partial-failure retry completes.
      await ctx.db.patch(existingProfile._id, patchFields);
      await ensureEnrollments();
      // Belt-and-braces: still flip onboardingComplete in
      // case the prior save crashed between the writes.
      await ctx.db.patch(user._id, { onboardingComplete: true });
      profileId = existingProfile._id;
    } else {
      // Insert the profile. Validation above guarantees
      // no duplicate by user and no dangling subject ids.
      profileId = await ctx.db.insert("tutorProfiles", {
        ...patchFields,
        userId: user._id,
      });
      await ensureEnrollments();
      await ctx.db.patch(user._id, { onboardingComplete: true });
    }

    return profileId;
  },
});

/**
 * getMine.
 *
 * Read-side: returns the onboarding profile for the calling
 * user, or `null` if not yet onboarded. Used by the AI tutor
 * route handler to inject personalization instructions into
 * the system prompt.
 */
export const getMine = query({
  args: {},
  returns: v.union(
    v.object({
      id: v.id("tutorProfiles"),
      userId: v.id("users"),
      grade: v.number(),
      curriculum: curriculumArg,
      curriculumName: v.string(),
      curriculumFreeform: v.union(v.string(), v.null()),
      enrolledSubjectIds: v.array(v.id("subjects")),
      weakestSubjectIds: v.array(v.id("subjects")),
      preferredExplanationStyle: explanationStyleArg,
      feedbackStyle: feedbackStyleArg,
      learningPreference: learningPreferenceArg,
      biggestObstacle: biggestObstacleArg,
      primaryGoal: primaryGoalArg,
      communicationStyle: communicationStyleArg,
      completedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const profile = await ctx.db
      .query("tutorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!profile) return null;
    return {
      id: profile._id,
      userId: profile.userId,
      grade: profile.grade,
      curriculum: profile.curriculum,
      curriculumName: profile.curriculumName,
      curriculumFreeform: profile.curriculumFreeform ?? null,
      enrolledSubjectIds: profile.enrolledSubjectIds,
      weakestSubjectIds: profile.weakestSubjectIds,
      preferredExplanationStyle: profile.preferredExplanationStyle,
      feedbackStyle: profile.feedbackStyle,
      learningPreference: profile.learningPreference,
      biggestObstacle: profile.biggestObstacle,
      primaryGoal: profile.primaryGoal,
      communicationStyle: profile.communicationStyle,
      completedAt: profile.completedAt,
    };
  },
});
