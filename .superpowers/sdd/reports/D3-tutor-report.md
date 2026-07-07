# D3 — Normalize button heights across Composer + MessageActions

## Status
Done.

## Files changed

1. `components/tutor/Composer.tsx` line 460
   - **Change**: `h-7` → `h-9` on the Retry button (primary button with text)
   - **Rationale**: Primary buttons with text should be `h-9` (36px).

2. `components/tutor/MessageActions.tsx` line 461
   - **Change**: `h-6 w-6` → `h-7 w-7` on the `ActionButton` component
   - **Rationale**: Icon-only action buttons should be `h-7 w-7` (28px).

## Buttons checked and left unchanged

### Composer.tsx
- **Send/Stop button**: already `h-9 w-9` — correct (primary action, circular).
- **Tool buttons** (equation, flashcards, practice, summarize, exam, compare, inline practice): already `h-7 w-7` — correct (icon-only actions).
- **Subject chip**: `h-7` pill, not a button — no change needed.
- **Suggestion chips**: `h-7` text buttons at the empty-state — these are small prompt chips, not primary command buttons. No change needed.

### MessageActions.tsx
- **MenuItem**: `h-7 w-full` — this is a menu row component (not an icon button). The height is already aligned with the action-button standard.

## Concerns
None. No other styling (colors, padding, borders, icon sizes) was modified.
