# A1 — Shared Tutor Types

## Status

Done.

## Files changed

- **Created**: `src/lib/ai/types/tutor.ts` — contains `TutorProfileLike`, `StrategyState`, `ModeType`, `ModeOptions`, `OnFinishPayload`, and `ChatRequestShape` types.
- **Modified**: `app/api/tutor/chat/route.ts`
  - Added import: `import type { TutorProfileLike, StrategyState } from "@/lib/ai/types/tutor";`
  - Removed inline `type StrategyState` block (was lines 174-188).
  - Removed inline `type TutorProfileLike` block (was lines 599-650) along with the `// Types & helpers` section comment that preceded it.

## Concerns

None. All types were faithfully extracted and exported. The remaining references to `TutorProfileLike` and `StrategyState` in the route file now resolve via the import. The removed section header had no purpose beyond introducing the now-removed inline type.
