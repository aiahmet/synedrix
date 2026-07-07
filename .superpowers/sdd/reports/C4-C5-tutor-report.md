# C4+C5: EmptyChatArea component + topic picker chips

**Status:** Complete

## Files Changed

### Created
- `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\components\tutor\EmptyChatArea.tsx` — new component with three visual states

### Modified
- `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\app\(app)\tutor\TutorClient.tsx` — integrated EmptyChatArea, removed ShellSkeleton

## What Was Done

### EmptyChatArea component (`components/tutor/EmptyChatArea.tsx`)
- Three states: `"loading"`, `"new_thread"`, `"subject_only"`
- **Loading state**: skeleton placeholders (animate-pulse divs matching the old ShellSkeleton content area)
- **new_thread/subject_only state**: centered welcome message with Target icon, "Ready to study {subject}" heading, contextual subtitle, and topic picker chips
- Topic chips are `Link` elements showing a mastery SVG ring, topic title, optional "HIGH" exam relevance badge, and an arrow icon
- Falls back to "Type a question below..." when no topic suggestions are available
- Chips link to the topic's page (`/subjects/{slug}/{chapterSlug}/{topicSlug}`)

### TutorClient.tsx modifications
1. Added `EmptyChatArea` import
2. Replaced `ShellSkeleton` loading shell with `TutorTopBar` + `EmptyChatArea state="loading"` + composer placeholder — preserves the top bar and composer skeleton during loading
3. Added `useQuery(api.tutorSessions.getSubjectTopicsForEmptyState, ...)` inside `TutorChat` — skips query when `topicId` is set; fetches up to 6 suggestions for subject-only threads
4. Replaced the empty `<div className="flex-1" />` with `<EmptyChatArea state={props.topicId ? "new_thread" : "subject_only"} ... />`
5. Removed the unused `ShellSkeleton` function entirely

## Concerns
- The loading state no longer renders `ShellSkeleton`'s `h-14` header bar — it uses `TutorTopBar` instead for visual consistency with the ready state
- Topic suggestions are only fetched when `topicId` is null (subject-only mode). When a topic is already selected (`"new_thread"` state), suggestions are not fetched, so the fallback text appears instead
- The `EmptyChatArea` component imports `Target` and `ArrowRight` from `@phosphor-icons/react` (already a dependency), and uses Tailwind classes consistent with the project's design system (`bg-surface`, `border-border`, `bg-accent/10`, etc.)
