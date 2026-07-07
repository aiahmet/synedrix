# D2: Query Latency Telemetry for Tutor Queries

## Status
Complete

## Files Changed

### `convex/tutor.ts`
- **getThread** (query): Added `Date.now()` timing wrapper with >500ms console.warn
- **listMessages** (query): Added timing wrapper
- **getThreadHistory** (query): Added timing wrapper
- **getContextForChat** (query): Added timing wrapper (most expensive query — loads subject, topic, progress, mistakes)
- **ensureThread** (mutation): Added timing wrapper
- **appendUserMessage** (mutation): Added timing wrapper
- **recordAssistantMessage** (mutation): Added timing wrapper

### `convex/tutorModes.ts`
- **getSummarizeContext** (query): Added timing wrapper
- **getExamContext** (query): Added timing wrapper
- **getCompareContext** (query): Added timing wrapper

### `convex/tutorPractice.ts`
- **getInlineSessionsForThread** (query): Added timing wrapper
- **getInlineSessionForRunner** (query): Added timing wrapper
- **getSubjectSlug** (query): Added timing wrapper
- **getInlineItemForGrading** (query): Added timing wrapper

### `convex/tutorHistory.ts`
- **listThreadsForSidebar** (query): Added timing wrapper

## Implementation Details

- Each handler body begins with `const start = Date.now();`
- Timing is computed per early-return point (fast check for unauthenticated user, missing thread, etc.) and at the final return path
- Slow queries (>500ms) log: `console.warn(\`[tutor-telemetry] queryName took ${ms}ms\`)`
- No change to return values, types, or query behavior — purely additive telemetry
- No external dependencies introduced

## Concerns

- Queries cannot use `ctx.scheduler` for DB writes, so telemetry is limited to `console.warn` logging rather than persisting to `aiGenerations` table. This is acceptable per the spec's pragmatic recommendation.
- The >500ms threshold is a fixed heuristic. If many queries consistently exceed it under normal load, the threshold may need tuning.
- Inline practice queries (`getInlineSessionForRunner`, `getInlineItemForGrading`) do per-item loops with individual index lookups — these are the most likely to benefit from this telemetry for future optimization.
