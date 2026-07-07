# D6 — Mobile Responsive Audit of Tutor Components

**Status:** Complete

## Files Changed

| File | Change |
|------|--------|
| `components/tutor/MessageList.tsx` | Added `break-words` to user bubble `<p>` (line 289) |
| `components/tutor/StructuredResponse.tsx` | Added `break-words` to key insight `<p>` (line 254) |
| `components/tutor/StructuredResponse.tsx` | Added `break-words` to affirmation `<p>` (line 355) |

## Audit Results Per Check

### 1. Composer doesn't overlap with keyboard
- `dvh` unit: Already uses `min-h-[100dvh]` on the outer shell (TutorClient.tsx line 65). **PASS**
- `env(safe-area-inset-bottom)`: Already present on composer sticky area as `pb-[max(0.75rem,env(safe-area-inset-bottom))]` (TutorClient.tsx line 334). **PASS**

### 2. History drawer slides over chat (doesn't push it)
- TutorDrawer uses `fixed inset-y-0 z-50` positioning with a `z-40` backdrop overlay. It slides over content rather than pushing layout. **PASS**

### 3. MessageActions wrap correctly
- Secondary icons (Helpful, Flashcards, Note, Share) all use `hidden sm:inline-flex` and collapse into a `DotsThreeVertical` More popover on `<sm` using `relative sm:hidden`. **PASS**
- Primary row uses `flex-wrap`. **PASS**

### 4. Inline practice tile scrollable within viewport
- Uses `w-full max-w-[42rem]` constrained by the parent `max-w-3xl` container. Content wraps naturally. **PASS**

### 5. General responsive checks
- `max-w-3xl` on main content area (TutorClient.tsx line 309). **PASS**
- `px-4 sm:px-6` responsive padding on both the content area and sticky composer (TutorClient.tsx lines 309, 334). **PASS**
- **Text overflow safety:** Three paragraphs were missing `break-words` — user message bubble, key insight section, and affirmation section. Fixed by adding `break-words`.

## Concerns

- No functional changes were made — only CSS class additions (`break-words`).
- The `break-words` additions are safety nets for pathological unbroken strings (URLs, long German compound words) that `whitespace-pre-wrap` alone would not break.
- All other responsive patterns (flex-wrap, hidden-on-mobile, dvh units, safe-area-inset) were already correctly implemented.
