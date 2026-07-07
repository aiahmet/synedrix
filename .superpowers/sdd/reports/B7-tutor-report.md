# B7 Report: Remove legacy special mode route handlers

## Status: Complete

## Files deleted
1. `app/api/tutor/exam/route.ts`
2. `app/api/tutor/compare/route.ts`
3. `app/api/tutor/summarize/route.ts`

## References cleaned
- **`app/api/tutor/chat/_lib/modeInstructions.ts`** — Removed 3 stale JSDoc comments that cited the deleted files as the source of the extracted code (`Extracted verbatim from \`app/api/tutor/exam/route.ts\`` etc.). The mode instruction builder functions themselves are kept — they are the replacement for the legacy routes, not a reference to them.

## Verification
- `grep` for `api/tutor/exam`, `api/tutor/compare`, and `api/tutor/summarize` across all `.ts/.tsx/.js/.jsx` files returns **zero results**.
- All three route directories (`app/api/tutor/exam/`, `app/api/tutor/compare/`, `app/api/tutor/summarize/`) are empty (only `.` and `..` entries remain).

## Concerns
- The three empty directories (`exam/`, `compare/`, `summarize/`) remain on disk. They could be cleaned up if desired, but they are harmless and won't affect routing since they contain no `route.ts` file.
