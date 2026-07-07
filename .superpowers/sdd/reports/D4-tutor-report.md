# D4 — Keyboard Shortcut Tooltip in Composer

**Status**: Complete

## Files Changed

- `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\components\tutor\Composer.tsx`

## What Was Done

Added a keyboard shortcut hint paragraph inside the flex-col div that wraps the textarea, placed immediately after the `<textarea>` element and before the closing `</div>` (i.e., before the bottom button row containing the send button and tool icons).

The hint displays:
- `/` to focus
- `Esc` to stop
- `Cmd+Enter` to send

Each key is rendered as a `<kbd>` element styled with `rounded border border-border bg-surface px-1 py-px font-mono text-[10px]`. The entire hint uses `hidden sm:block` to hide on touch devices, `text-muted-foreground/60` for a faint appearance, and `pt-1` for minimal vertical spacing. No other elements or layout properties were changed.

## Concerns

None. The hint sits inside the existing flex-col wrapper, downstream of the existing keyboard shortcut display in the tool row (which shows Enter/Shift+Enter mappings). The two are complementary — the existing tool row hint stays as-is.
