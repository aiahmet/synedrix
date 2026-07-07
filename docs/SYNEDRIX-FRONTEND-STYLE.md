# Synedrix Frontend Style Guide

> The single source of truth for the editorial, anti-slop design language
> shipped across the Synedrix frontend. Every surface — auth, marketing,
> app shell, lesson, tutor — must read as the same product. This guide is
> the rulebook.

---

## 0. Philosophy (in five lines)

1. **Typography is the design.** Hierarchy, scale, and tracking do the
   work. Heavy chrome does not.
2. **One background per surface.** Halos, dot grids, and gradient
   blobs are banned. Two-room layouts use a single `bg-background`
   plus a thin border, never a tinted "left pane."
3. **Every container is single-layer.** No `border` wrapping a
   `bg-elevated` wrapping an inner padded box. Pick one surface.
4. **Colors earn their place.** The accent color appears on focus
   rings, the primary CTA, and brand-panel icons. Nowhere else.
5. **Write honest copy.** No "Welcome to the future of learning,"
   no proof-checkmark lists, no fake stats. Real product facts.

The look is editorial: confident type, low contrast, breathing room,
warm whitespace. The look is **not** a Vercel/Linear/Stripe clone.

---

## 1. Anti-Patterns (banned)

If a surface ships any of these, it is not on-brand. Reject it.

- **Halo blobs.** `<div class="bg-[var(--halo-1)] blur-[120px]">` and
  friends. Replace with `bg-background` and let typography do the work.
- **Radial dot grids.** `radial-gradient(circle, currentColor 0.6px,
  transparent 0.6px)` over the page background. Kill it.
- **Triple-nested cards.** A decoration ring around a border around
  an inner padded inner box. Pick the outermost one and stop.
- **Carded list rows.** Wrapping each list item in `border
  bg-surface-elevated/40 p-3.5`. Lists are typography. Don't card them.
- **Pill/track uppercase eyebrow chips.** `bg-accent-subtle/60 px-3 py-1
  uppercase tracking-[0.18em] text-accent`. Use plain uppercase muted
  text.
- **Bouncy CTAs.** `active:scale-[0.98]`. Buttons don't bounce. They
  press.
- **Airy focus rings.** `focus:ring-2 focus:ring-ring focus:border-ring`
  with no contrast. Use crisp `focus:border-foreground focus:ring-1
  focus:ring-foreground/40` instead.
- **Loud dividers.** `text-muted-foreground text-xs uppercase
  tracking-wider`. Use lowercase muted text with `bg-background`
  padding so it punches through the line.
- **Generic H2s.** "Start the system that compounds with you." Cut or
  rewrite with a concrete noun ("The intelligence layer for your
  Abitur.").
- **Proof-checkmark lists.** Three `icon + string` rows under the
  feature list. One GitHub-link + licence line is enough.
- **Icon containers.** `bg-accent/10 ring-1 ring-accent/10` around a
  20×20 icon. Just render the icon at its native size.
- **Center-aligned form titles.** Use left-aligned, stacked typography.

The number-one litmus test: if the page would still look correct in
**plain Arial**, the design is probably right. If it only works because
of decorative chrome, the design is wrong.

---

## 2. Typography

| Role | Class | Notes |
| --- | --- | --- |
| Editorial H2 (page-level) | `text-[clamp(1.95rem,2.4vw+0.5rem,2.75rem)] font-semibold leading-[1.04] tracking-[-0.024em]` | Use a manual `<br />` for a magazine-linebreak effect. Concretize the noun, not the verb. |
| Form H1 (sign-in / sign-up card) | `text-[22px] font-semibold leading-[1.05] tracking-[-0.022em] text-foreground` | Left-aligned, stacked above a smaller description. |
| Section H3 / row title | `text-[13.5px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground` | Tighter tracking than the dock default; reads serious. |
| Body | `text-[14.5px] leading-[1.55] text-muted-foreground` | Max width `max-w-md` for paragraph blocks. |
| Caption / sub-body | `text-[12.5px] leading-[1.55] text-muted-foreground` | Used for "&nbsp;this item's secondary text". |
| Micro / metadata | `text-[11.5px] text-muted-foreground/80` | For licence lines, build hashes, helper text. |
| Eyebrow | `text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground` | Plain text, no pill. |
| Stat callout | `text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80` | On the auth sign-in panel only. |

Number rule: type sizes scale by ~1.5× between rows of the table.
Clamp-based fluid sizing is allowed on hero/editorial text only.

---

## 3. Color & Contrast

The system has two roles: `foreground` (high-contrast, near-black in
light, near-white in dark) and `muted-foreground` (low-contrast).
`accent` is rare; treat it as a highlight.

| Use | Token | Examples |
| --- | --- | --- |
| Primary text | `foreground` | H1, H2, row titles, body when strong |
| Secondary text | `muted-foreground` | Body, captions, descriptions |
| Brand panel icon (idle) | `muted-foreground` | Brightens to `foreground` on `group-hover:` |
| Primary CTA | `accent` / `accent-foreground` | Sign-in / sign-up submit, "Continue", "Start topic" |
| Focus ring + border | `foreground` at `/40` opacity | Always paired with `focus:border-foreground` |
| Destructive / error | `subject-french` / `subject-chemistry` | Input error / success text |
| Surface tint (subtle) | `surface-elevated` at `/30` | Two-room brand-pane distinction |

Rule: if `accent` appears more than twice on a single page, it's
overused. Reserve it for primary action + 1-2 brand surfaces.

---

## 4. Spacing & Rhythm

- **Vertical grid:** multiples of `0.25rem`. Prefer `gap-4` (1rem),
  `gap-6` (1.5rem), `gap-7` (1.75rem), `gap-9` (2.25rem).
- **Section separation:** `border-b` between stacked sections, **not**
  big vertical padding.
- **Card padding:** `p-7 sm:p-8` is the default. Form cards drop to
  `p-6` only when a third-party widget (Clerk) requests it.
- **Brand-pane padding:** `lg:px-12 xl:px-16`. Wider than this and the
  content feels sparse.

Rule: if the page reads as "wall," you have too much chrome. If it
reads as "void," you have too much padding. Hit `gap-7` between
top-level regions.

---

## 5. Surfaces & Cards

### Single-layer card (the rule)

```tsx
<div className="relative rounded-xl border border-border bg-background p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] sm:p-8 dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]">
```

Two-shadow layered shadow:
- A tight `0 1px 3px rgba(0,0,0,0.04)` for edge definition (light-only).
- A soft `0 8px 24px -16px` floor for lift (light + dark, scaled).

### Two-room layout (auth, marketing two-pane)

```tsx
<aside className="border-b border-border bg-surface-elevated/30 px-6 pb-10 pt-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-14 xl:px-16">
  {/* brand panel */}
</aside>
<section className="flex items-start justify-center bg-background px-6 py-10 sm:px-10 lg:items-center lg:px-12 lg:py-14 xl:px-16">
  {/* form panel */}
</section>
```

Notes:
- Brand aside: `bg-surface-elevated/30` for subtle distinction + `border-r`
  on `lg+`. Mobile collapses to a stacked layout with `border-b`.
- Form section: pure `bg-background`, content centered with `max-w-md`.

---

## 6. Buttons

### Primary CTA

```tsx
<button className="h-10 rounded-md bg-accent text-accent-foreground text-[13px] font-medium hover:bg-accent/90 transition-colors shadow-none disabled:opacity-60 disabled:cursor-not-allowed">
```

- Always `h-10 rounded-md`. The `h-11` days are over.
- No `active:scale-[0.98]` — buttons don't bounce.
- `hover:bg-accent/90` is quieter than `hover:opacity-90`.

### Secondary / Reset

```tsx
<button className="h-10 rounded-md border border-border bg-background text-foreground text-[13px] font-medium hover:bg-surface transition-colors">
```

### Social / OAuth (third-party)

```tsx
<button className="h-10 rounded-md border border-border bg-background hover:bg-surface text-foreground text-[13px] font-medium transition-colors shadow-none">
```

The third-party button is **less decorated** than the primary CTA.
That hierarchy matters: the CTA is the goal, OAuth is the alternative.

---

## 7. Inputs & Forms

### Text input

```tsx
<input className="h-10 rounded-md border border-border bg-surface-elevated px-3.5 text-[13.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground/40 transition-colors" />
```

- `bg-surface-elevated` (not transparent) on inputs.
- Crisp focus: full-foreground border + 1px ring at 40% opacity.
  Contrast ≥3:1 in both themes. No airy `focus:ring-2` glow.
- Heights match buttons: `h-10`. Use `h-12` only for OTP code fields.

### Field label

```tsx
<label className="text-[12.5px] font-medium text-foreground tracking-[-0.005em]" />
```

Labels are sentence-cased, not sentence-cased-with-colon. Spacing is
`mb-1.5` to the input. Errors get `mt-1.5`.

### Error / hint / success

```tsx
<p className="text-[11.5px] text-subject-french mt-1.5" />     {/* error */}
<p className="text-[11.5px] text-subject-chemistry mt-1.5" />  {/* success */}
<p className="text-[11.5px] text-muted-foreground mt-1.5" />    {/* hint */}
```

### Divider

```tsx
<div className="my-6 flex items-center gap-3">
  <span className="h-px flex-1 bg-border" />
  <span className="text-muted-foreground text-[11.5px] font-normal normal-case tracking-normal px-2 bg-background">or continue with email</span>
  <span className="h-px flex-1 bg-border" />
</div>
```

Lowercase, low-contrast, with `bg-background` padding so the text
punches through the line. Do not center the entire divider block —
left-align it within the form.

---

## 8. Iconography

We ship Phosphor icons. Default rules across the app:

| Use | Icon size | Weight | Color |
| --- | --- | --- | --- |
| Brand-panel row icon (idle) | `h-4 w-4` | `duotone` | `text-muted-foreground` |
| Brand-panel row icon (hover) | same | same | `group-hover:text-foreground` |
| Inline metadata icon | `h-3.5 w-3.5` | `duotone` or `bold` | `text-muted-foreground` |
| CTA icon | `h-3 w-3` | `bold` | inherits button text color |
| Status icon (success/error) | `h-3.5 w-3.5` | `bold` or `fill` | `subject-chemistry` / `subject-french` |
| Section header icon | `h-5 w-5` | `duotone` | `text-accent` |

Never wrap an icon in `bg-accent/10 ring-1 ring-accent/10`. Just render
it at native size and color.

---

## 9. Backgrounds (banned)

The following are out forever:

- Halo blobs (`blur-[120px]` floating gradients).
- Radial dot grids.
- `linear-gradient(135deg, color1, color2)` over backgrounds.
- Decorative animated SVGs at the page level.

The only acceptable background treatments:

- `bg-background` (default).
- `bg-surface-elevated/30` for a two-pane brand distinction.
- `dark:bg-zinc-950/40` for inverse dark surfaces on a single-tinted
  pane (rare; reserved for the nav rail).

If a screen is missing visual interest, the typography is the fix —
not more background decoration.

---

## 10. Two-Room Layout (canonical pattern)

Used on `/sign-in`, `/sign-up`, and any future "split marketing +
form" page.

```tsx
<div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
  {/* Quiet header: brand mark + theme toggle + alt-mode link */}
  <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-4">
    <Link href="/" className="group flex items-center gap-2.5 rounded-md ...">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-[10px] font-bold tracking-tight text-background">
        SX
      </span>
      <span className="text-[13.5px] font-medium tracking-[-0.005em]">
        Brand
      </span>
    </Link>
    <div className="flex items-center gap-1">
      <ThemeToggle />
      <Link href={alternate.href} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
        <span className="hidden sm:inline">{alternate.label}</span>
        <ArrowRight className="h-3 w-3" weight="bold" />
      </Link>
    </div>
  </header>

  <main className="relative z-10 grid flex-1 grid-cols-1 lg:grid-cols-2">
    <aside className="border-b border-border bg-surface-elevated/30 ...">
      <BrandPanel />
    </aside>
    <section className="flex items-start justify-center bg-background ...">
      <div className="w-full max-w-md">
        <FormCard />
      </div>
    </section>
  </main>

  <footer className="relative z-10 px-6 py-5 sm:px-10">
    <p className="mx-auto max-w-6xl text-center text-[11px] leading-relaxed text-muted-foreground/70">
      {legalNote}
    </p>
  </footer>
</div>
```

---

## 11. Brand Panel (canonical content pattern)

```tsx
const SIGN_IN_ROWS = [
  {
    icon: Sparkle,
    title: "Continue exactly where you left off",     // real, concrete
    body: "Mastery, recent mistakes, and the review queue load the moment you sign in.",
  },
  {
    icon: ChatCircleText,
    title: "The tutor already knows your context",
    body: "Subject, topic, and recent errors sync across every device you use.",
  },
  {
    icon: ShieldCheck,
    title: "Your data never leaves your tenant",
    body: "We never sell, share, or train models on your work.",
  },
];

const SIGN_UP_ROWS = [
  // 4 highlights — feature pillars
];

const SIGN_IN_STAT = "1 cockpit · 5 systems · always-on review queue";
```

Render:

```tsx
<div className="flex w-full max-w-2xl flex-col gap-7 lg:gap-9">
  <div className="flex flex-col gap-4">
    <AuthEyebrow>{isSignIn ? "Welcome back" : "Get started"}</AuthEyebrow>
    <h2 className="text-balance text-[clamp(1.95rem,2.4vw+0.5rem,2.75rem)] font-semibold leading-[1.04] tracking-[-0.024em] text-foreground">
      {isSignIn
        ? <>Pick up where<br />you left off.</>
        : <>The intelligence layer<br />for your Abitur.</>}
    </h2>
    <p className="max-w-md text-pretty text-[14.5px] leading-[1.55] text-muted-foreground">
      {/* one calm paragraph */}
    </p>
  </div>

  <ul className="flex flex-col gap-4">
    {rows.map(row => (
      <li key={row.title} className="group flex items-start gap-3.5">
        <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" weight="duotone" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">{row.title}</p>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-muted-foreground">{row.body}</p>
        </div>
      </li>
    ))}
  </ul>

  <div className="flex flex-col gap-1.5 border-t border-border pt-5">
    <a href="https://github.com/..." className="group inline-flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-foreground hover:text-accent">
      View the source on GitHub
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" weight="bold" />
    </a>
    <p className="text-[11.5px] text-muted-foreground/80">
      MIT licensed. Self-host or use the hosted instance.
    </p>
  </div>
</div>
```

Sign-in panel: add a small uppercase stat callout above the rows to
prevent sparseness:

```tsx
{isSignIn && (
  <div
    className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80"
    aria-label="Architecture summary"
  >
    {SIGN_IN_STAT}
  </div>
)}
```

---

## 12. Components Catalog (snapshot)

| Component | File | Purpose |
| --- | --- | --- |
| `AuthShell` | `components/auth/AuthShell.tsx` | Two-pane shell + header + footer |
| `AuthFormCard` | `components/auth/AuthShell.tsx` | Single-layer form container |
| `AuthEyebrow` | `components/auth/AuthShell.tsx` | Plain uppercase label |
| `AuthBrandPanel` | `components/auth/AuthBrandPanel.tsx` | Brand-aside content (rows + H2 + GitHub line) |
| `ThemeToggle` | `components/ThemeToggle.tsx` | Light/dark switch in nav |
| `MasteryRing`, `CockpitCard`, `CockpitStatsRow`, … | `components/dashboard/*` | App-shell primitives |

When adding a new primitive component:

1. Place it in the right folder (`components/auth/`, `components/dashboard/`,
   `components/tutor/`, etc.).
2. Use single-layer chrome.
3. Use the token table in §3 — never hardcode `zinc-50` unless the
   token system is missing a surface tint.
4. Document the role with a one-paragraph JSDoc block. **No
   `interface FooProps { readonly foo: string }` boilerplate inside
   the file — type props directly on the components above.**

---

## 13. Ready-to-ship checklist

Before a surface goes out:

- [ ] **One background.** No halos, no dot grids, no gradients.
- [ ] **Single-layer cards.** No triple-nested chrome.
- [ ] **No carded rows in lists.** Typography does the work.
- [ ] **Editorial H2.** Concrete noun, manual `<br />`, tight tracking.
- [ ] **Plain eyebrow.** No pill chip.
- [ ] **Form card is left-aligned.** Title + description stacked.
- [ ] **Buttons are `h-10 rounded-md`.** No `active:scale-[0.98]`.
- [ ] **Inputs have crisp focus.** `focus:border-foreground
      focus:ring-1 focus:ring-foreground/40`.
- [ ] **Dividers are low-case muted.** Not loud uppercase.
- [ ] **Icons are native-sized.** No `bg-accent/10` containers.
- [ ] **`accent` appears ≤2× on the page.**
- [ ] **Copy is honest.** No fake stats or marketing cliches.
- [ ] **GitHub link counts as proof.** No checkmark lists.
- [ ] **Mobile reads cleanly.** Brand aside collapses to top;
      form takes the bottom; no horizontal overflow.
- [ ] **Dark mode uses a coherent shadow.** No stacked light+dark
      shadows.

If any box is unchecked, fix it before merging.
