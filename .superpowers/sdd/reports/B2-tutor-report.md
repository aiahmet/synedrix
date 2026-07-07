# B2 Report: `modeInstructions.ts`

**Status:** Complete

**File modified:**
- `app/api/tutor/chat/_lib/modeInstructions.ts` -- replaced stub functions with real implementations

## What was done

1. **Defined typed context interfaces** for each mode:
   - `ExamContext` -- includes subject/topic titles, mastery, difficulty, confidence, objectives, recent mistakes, related topics, conversation history, and student profile
   - `CompareContext` -- includes subject title, current topic (with difficulty/mastery/objectives), sibling topics, conversation history, and student profile
   - `SummarizeContext` -- includes subject/topic titles, message count, key objectives, recent mistakes (with user/correct answers), conversation history, and student profile

2. **Implemented `buildExamInstructions(context, taskCount?)`** -- reproduces the system prompt from `app/api/tutor/exam/route.ts` (lines 73-115) verbatim, parameterizing subject/topic title, task count, mastery percentage, difficulty, confidence, and all context blocks (objectives, mistakes, related topics, history, profile). Includes the full output format specification with task structure and exam summary section.

3. **Implemented `buildCompareInstructions(context)`** -- reproduces the system prompt from `app/api/tutor/compare/route.ts` (lines 67-105) verbatim, parameterizing subject title, topic tag, difficulty, mastery, learning objectives, sibling topics, history, and profile. Includes the full comparison table structure, decision guide, and study tip sections.

4. **Implemented `buildSummarizeInstructions(context, mode?)`** -- reproduces the system prompt from `app/api/tutor/summarize/route.ts` (lines 71-88) verbatim, parameterizing subject/topic title, message count, objectives, mistakes, history, and profile. The `mode` parameter controls the embedded modeInstruction (cheat_sheet / revision_notes / summary_paragraph), matching the original logic on lines 65-69 of the source.

## Key decisions

- **History truncation** preserves the source-specific slice lengths (400 chars for exam/compare, 500 for summarize)
- **Empty-list fallbacks** use the exact string literals from each source route (e.g. `"(no objectives recorded)"`, `"(no conversation history)"`)
- **Default values** match the source: `taskCount` defaults to 4, `topicDifficulty` falls back to `"standard"`
- `profile` is typed as optional (`| null`) so callers can pass `null` when the profile query fails

## Verification

All three functions were cross-referenced line-by-line against the source route files. No deviations from the original prompt text were introduced -- only dynamic values were replaced with template parameters.

## Concerns

None.
