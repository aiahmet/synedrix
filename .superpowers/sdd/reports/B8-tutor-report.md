# B8 — Add mode-specific rendering in `StructuredResponse`

## Status
Complete.

## Files Changed
- `components/tutor/StructuredResponse.tsx` — 4 edits, no other files touched.

## Changes Made

1. **Added icon imports** (line 39-41): `ClipboardText`, `ArrowsLeftRight`, `Notepad` from `@phosphor-icons/react/dist/ssr`.

2. **Added `mode` field to `StructuredContent` interface** (line 57): Optional `readonly mode?: string` so the parsed structured content carries the mode discriminator from B4.

3. **Added three mode-specific early-return branches** (lines 119-196), before the default rendering:
   - **`"exam"` mode**: Renders a "Practice Exam" header with `ClipboardText` icon, explanation as markdown, and key insight as "Tips" in a bordered card.
   - **`"compare"` mode**: Renders a "Comparison" header with `ArrowsLeftRight` icon, explanation as markdown, and key insight as "Decision Guide" in a bordered card.
   - **`"summarize"` mode**: Renders a "Revision Notes" header with `Notepad` icon, explanation as markdown, key insight with a left-accent border and italic text, and affirmation as "Key Takeaway" in a card.

4. **Passed `mode` through `tryParseStructured`** (line 538): When parsing JSON structured content, `mode` is extracted as a string if present, or left `undefined`.

5. **Default path unchanged**: When `mode` is `undefined`, `"default"`, or any unrecognized value, the original 5-section rendering (explanation, visual, key insight, check, next, affirmation) runs unchanged.

## Design Decisions
- Used `AIMarkdown` instead of a non-existent `renderMarkdownContent` — the component already uses `AIMarkdown` for all markdown rendering, so mode-specific branches reuse the same pattern.
- Mode detection uses a type assertion (`as "exam" | "compare" | "summarize" | undefined`) since the `mode` field travels as an optional string through JSON — callers in B4 own setting it correctly.
- `parseFromRawText` (raw text fallback) does not attempt to extract `mode` — mode is a structured concept only available from the JSON parse path.

## Concerns
- None. The changes are additive and fully backward-compatible with existing non-mode messages.
