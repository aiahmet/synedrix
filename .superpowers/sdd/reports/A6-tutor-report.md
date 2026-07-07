# A6 — Extract `getPersonalizationSignals` from `convex/tutorModes.ts`

## Status

**Complete.** The `getPersonalizationSignals` query has been extracted from `convex/tutorModes.ts` into its own module at `convex/tutorSignals.ts`. All logic is preserved verbatim.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `convex/tutorSignals.ts` | **Created** | New module containing `getPersonalizationSignals` query (167 lines) |
| `convex/tutorModes.ts` | **Modified** | Removed `getPersonalizationSignals` function (lines 366-526), cleaned up unused imports |

### `convex/tutorModes.ts` changes

- **Removed** `getPersonalizationSignals` query (the entire export, previously ~160 lines at end of file).
- **Removed** `mutation` from the `./_generated/server` import (no remaining function in the file uses it).
- **Removed** `Doc` from the `./_generated/dataModel` type import (not used by any remaining function).
- **Removed** `requireUser` from the `./users` import (not used by any remaining function; `resolveUserReadOnly` is used by all three remaining queries).

### `convex/tutorSignals.ts` (new file)

- Contains `getPersonalizationSignals` with identical args validator, returns schema, and handler logic.
- Imports: `query` from `./_generated/server`, `v` from `convex/values`, `resolveUserReadOnly as resolveUser` from `./users`.

## Consumers

No runtime consumers of `api.tutorModes.getPersonalizationSignals` were found in the app code (components, route handlers, or other Convex files). Only documentation files reference the old path. Therefore no import path updates were needed.

## Concerns

1. **Unused `confidence` variable** — The handler body declares `const confidence = progress?.confidence ?? 0;` on line 102 of the new file, but `confidence` is never referenced again. This is a pre-existing issue in the original code (not introduced by this extraction).
2. **Unused `DAY_MS` constant** — `const DAY_MS = 86_400_000;` on line 6 of `tutorModes.ts` is not used by any remaining function. It was also not used by `getPersonalizationSignals`. Pre-existing dead code; considered out of scope for this task.
