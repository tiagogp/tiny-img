# DESIGN.md

**Longwave Studio — Design System**
Version 1.0 · Source of truth for design and engineering

---

## 0. About this document

This is a working specification, not a mood board. Every value here is meant to be copied
into code. Where a rule allows judgment, the judgment is stated explicitly.

**The subject.** Longwave is a brand and motion studio. The site's single job is to make a
prospective client believe the studio can make *their* brand look like the artwork on this
page. Everything follows from that: the work is loud, the interface is quiet.

**The visual thesis.** Screen-printed poster art — surreal landscapes, graphic skies, hard
silhouettes, four inks and no more — presented inside a precise, almost clinical modern
interface. The tension between those two things *is* the design. Neither half works alone.

**Reference handling.** The reference direction informs principles, not pixels. Do not
reproduce any specific layout, illustration, or wordmark from it.

---

## 1. Design principles

Seven principles. When two conflict, the earlier one wins.

### 1.1 Art first, interface second

The artwork is the argument. On any given screen, one image should be unmistakably the
subject and everything else should read as caption, label, or control. Practically: if a
section contains a hero image, that image gets at least 50% of the section's vertical
space, and no other element in that section may use a saturated accent color.

### 1.2 Editorial hierarchy

Hierarchy comes from size, weight, and position — not from boxes, backgrounds, or color.
A section should be legible as a hierarchy in grayscale. Practically: a page has exactly
one display-size headline, and the jump between adjacent levels is large enough to be
obvious at a glance (roughly 1.4×–1.6× per step, never less than 1.25×).

### 1.3 Purposeful contrast

Contrast is a resource with a budget. Spend it on the one thing you want clicked or read.
Practically: at most one saturated accent element per viewport-height of scroll. A page
with three blue buttons has no blue button.

### 1.4 Generous spacing

Whitespace is the premium signal. It is cheaper than any other kind of polish and harder
to fake. Practically: section padding never drops below `--space-16` (64px) on mobile or
`--space-32` (128px) on desktop, and no two unrelated elements sit closer than
`--space-6` (24px).

### 1.5 Restrained interface

Controls should look engineered, not decorated. Neutral surfaces, hairline borders, pill
geometry, one radius family, no glass, no gradient fills on UI chrome. Practically: any
component that isn't artwork uses only `--color-ink`, `--color-bg`, `--color-surface`, and
border tokens — unless it is the primary action.

### 1.6 Expressive color

Vivid color belongs to the artwork, selected states, and the primary CTA. It never becomes
ambient. Practically: accent colors appear in illustrations, in the active/selected state
of a control, in one CTA, and in error/success messaging. Nowhere else.

### 1.7 Subtle physical texture

The page should feel printed, not rendered. Grain and halftone are applied at low opacity
and are always beneath type, never over it. Practically: global grain sits at 4–7% opacity;
halftone lives inside image assets, not in CSS over text.

---

## 2. Color system

The interface is built from six neutrals. The five accents are ink colors borrowed from
risograph printing — they belong to the artwork and to a small set of intentional UI moments.

### 2.1 Neutrals

| Token | HEX | Use | Contrast on `--color-bg` |
|---|---|---|---|
| `--color-bg` | `#FBFAF6` | Page canvas. Warm off-white, faint yellow cast, reads as uncoated paper. | — |
| `--color-surface` | `#F2EFE7` | Light surface: cards, inset panels, input fills, alternating sections. | — |
| `--color-surface-raised` | `#FFFFFF` | Modals, dropdowns, anything that must float above `--color-surface`. | — |
| `--color-ink` | `#1A1917` | Dark surface: nav bar, footer, inverted sections. Warm charcoal, never pure black. | 16.4:1 |
| `--color-ink-soft` | `#2C2A26` | Hover state for dark surfaces; secondary dark fills. | 13.6:1 |
| `--color-text-primary` | `#1A1917` | Headlines, body copy, labels. | 16.4:1 ✅ AAA |
| `--color-text-secondary` | `#4A4740` | Supporting paragraphs, card body, captions. | 8.9:1 ✅ AAA |
| `--color-text-muted` | `#6E6A60` | Metadata, timestamps, disabled-adjacent text, eyebrow labels. | 4.9:1 ✅ AA |
| `--color-text-inverse` | `#FBFAF6` | Text on `--color-ink`. | 16.4:1 on ink ✅ AAA |
| `--color-text-inverse-muted` | `#A5A096` | Secondary text on dark surfaces. | 5.9:1 on ink ✅ AA |
| `--color-border` | `#E4DFD4` | Thin page borders, dividers, card outlines, input borders at rest. | 1.3:1 (non-text) |
| `--color-border-strong` | `#C6BFB0` | Input borders on hover, table rules, emphasized dividers. | 2.0:1 |
| `--color-border-inverse` | `#3A3833` | Dividers on dark surfaces. | — |

> `--color-text-muted` is the floor for text. Anything lighter than `#6E6A60` fails AA at
> body sizes and must not be used for text of any size.

### 2.2 Action colors

| Token | HEX | Use |
|---|---|---|
| `--color-action` | `#1B3FA0` | Primary action. Deep ultramarine. White text on it: 8.7:1 ✅ AAA. |
| `--color-action-hover` | `#16327E` | Primary action hover. |
| `--color-action-active` | `#102459` | Primary action pressed. |
| `--color-action-subtle` | `#E8EBF7` | Selected rows, active tag fills, low-emphasis blue surfaces. |
| `--color-action-ink` | `#1A1917` | Secondary/neutral action fill (dark pill on light page). |

### 2.3 Artwork inks

These five exist so illustrations, halftone overlays, and SVG assets stay on-system. They
are **artwork-first** — see the usage column for the narrow UI exceptions.

| Token | HEX | Character | Permitted UI use |
|---|---|---|---|
| `--color-ink-blue` | `#1B3FA0` | Deep ultramarine. Skies, water, deep shadow. | Primary action (same value as `--color-action`). |
| `--color-ink-coral` | `#F4573D` | Warm coral-vermilion. Suns, figures, focal shapes. | Decorative rules and artwork only. Fails AA as text. |
| `--color-ink-coral-deep` | `#C2331D` | Darkened coral. | Text-safe coral (5.9:1). Use for coral-colored links or labels. |
| `--color-ink-amber` | `#FFB227` | Sunflower yellow-orange. Light sources, horizons, grain highlights. | Focus ring on dark surfaces only. Never as text on light. |
| `--color-ink-green` | `#00A05A` | Riso green. Terrain, foliage, counterforms. | Artwork only. |
| `--color-ink-green-deep` | `#0B7245` | Darkened green. | Text-safe green (4.8:1); doubles as success. |

**Four-ink rule.** A single illustration uses at most four of these inks plus paper white
and charcoal. This is what makes a set of images look like one body of work rather than a
stock library.

### 2.4 Feedback and system colors

| Token | HEX | Use |
|---|---|---|
| `--color-focus` | `#1B3FA0` | Focus ring on light backgrounds. |
| `--color-focus-inverse` | `#FFB227` | Focus ring on `--color-ink` surfaces. 8.9:1 against ink. |
| `--color-error` | `#C2331D` | Error text and borders. 5.9:1 on bg ✅ AA. |
| `--color-error-surface` | `#FBEAE6` | Error message background. |
| `--color-success` | `#0B7245` | Success text and borders. 4.8:1 ✅ AA. |
| `--color-success-surface` | `#E6F2EC` | Success message background. |
| `--color-warning` | `#8A5A00` | Warning text. Amber is not text-legible, so warnings use its dark relative. |
| `--color-warning-surface` | `#FDF2DC` | Warning message background. |
| `--color-overlay` | `rgba(26, 25, 23, 0.56)` | Modal scrim. |
| `--color-grain` | `rgba(26, 25, 23, 0.055)` | Global grain tint. |

### 2.5 Color rules

1. Accent colors never fill a full-width section background. Sections are `--color-bg`,
   `--color-surface`, or `--color-ink`.
2. Never place `--color-ink-coral`, `--color-ink-amber`, or `--color-ink-green` on
   `--color-bg` as text. Use their `-deep` variants.
3. Do not use color as the sole carrier of meaning. Errors get an icon and text; selected
   tags get a fill *and* a weight change.
4. Every color in the interface is reached through a token, never a literal. That is what
   lets §2.6 re-point the whole palette without touching a component.

### 2.6 Dark theme

Selected by `:root[data-theme="dark"]`, and only ever by that: a blocking script resolves
the stored choice — or `prefers-color-scheme` when there is none — before the first paint
and writes a concrete `light` or `dark` onto the root. CSS never reads the media query
itself, so the palette lives in one block instead of two, and a page with no script runs
light.

**The ink family shifts, it does not flip.** A dark surface is dark in both themes, so
`--color-ink`, `--color-ink-soft`, `--color-text-inverse` and their neighbours keep their
meaning: the nav pill and the footer stay the slabs they were, and every `text-inverse`
sitting on them stays legible without a second set of rules. What flips is the page.

| Token | Light | Dark | Note |
|---|---|---|---|
| `--color-bg` | `#FBFAF6` | `#100F0D` | Goes *below* the ink family so the pill and footer still read as lifted. |
| `--color-surface` | `#F2EFE7` | `#181611` | |
| `--color-surface-raised` | `#FFFFFF` | `#201E18` | |
| `--color-ink` | `#1A1917` | `#23211C` | Shifted up just enough to clear the new canvas. |
| `--color-ink-soft` | `#2C2A26` | `#2E2B25` | |
| `--color-text-primary` | `#1A1917` | `#F4F1E8` | 17.0:1 on dark bg ✅ AAA |
| `--color-text-secondary` | `#4A4740` | `#C4BDAE` | 10.3:1 ✅ AAA |
| `--color-text-muted` | `#6E6A60` | `#91897B` | 5.5:1 ✅ AA — the floor for text, as on light. |
| `--color-border` | `#E4DFD4` | `#2A2721` | |
| `--color-border-strong` | `#C6BFB0` | `#45413A` | |
| `--color-action` | `#1B3FA0` | `#3F61D6` | Inverse text on it: 4.95:1 ✅ AA. |
| `--color-action-hover` | `#16327E` | `#5473E8` | The ramp inverts — hover and active go **brighter**, not deeper. |
| `--color-action-active` | `#102459` | `#6A86EF` | |
| `--color-focus` | `#1B3FA0` | `#7F9DFF` | |

Two rules the accents follow. Deep ultramarine is a hole on a dark page, so action colors
lift until they read as light-emitting rather than desaturating (the reverse of what a
light canvas needs). And the feedback colors invert their mix: `--color-error` and friends
are cut with white instead of black, over a tinted surface dark enough to stay in the page.

Shadows move to true black and roughly double their alpha — a warm-black shadow is
invisible on a warm-black canvas. The grain (§1.7) switches from `multiply` to `screen` at
a lower opacity, for the same reason and in the same direction: on dark it has to lift.

---

## 3. Typography

### 3.1 Families

| Role | Family | Why | Fallback stack |
|---|---|---|---|
| Display / headings | **Space Grotesk** (OFL, variable 300–700) | A grotesk with deliberately odd terminals and a slightly technical, retro-futuristic skeleton. At display sizes its quirks read as personality; at small sizes it stays neutral. | `'Space Grotesk', 'Helvetica Neue', Arial, sans-serif` |
| Body | **IBM Plex Sans** (OFL, variable 100–700) | A true neo-grotesk with warmer humanist details than Inter, engineered for long-form legibility, and it ships a matching mono. | `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| Mono / utility | **Space Mono** (OFL, 400/700) | Space Grotesk's sibling. Ties eyebrows and metadata back to the display face and carries the printed-ephemera feel. Uppercase, small sizes, wide tracking only. | `'Space Mono', 'SFMono-Regular', Menlo, monospace` |

**Loading.** Self-host WOFF2 variable files. `font-display: swap`. Preload only the display
face and the body regular weight — those two are in the first paint. Subset to
`latin, latin-ext`. Total font payload target: **under 120 KB**.

```html
<link rel="preload" href="/fonts/space-grotesk-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ibm-plex-sans-var.woff2" as="font" type="font/woff2" crossorigin>
```

Set `size-adjust` on fallbacks to keep the layout stable during swap:

```css
@font-face {
  font-family: 'Space Grotesk Fallback';
  src: local('Arial');
  size-adjust: 97%;
  ascent-override: 96%;
  descent-override: 24%;
}
```

### 3.2 Type scale

All display and heading sizes are fluid via `clamp()`. Min values apply at 360px, max
values at 1440px. No manual breakpoint overrides for size — only for weight or wrapping.

| Style | Family | Size | Weight | Line height | Tracking | Notes |
|---|---|---|---|---|---|---|
| **Display** | Space Grotesk | `clamp(3.25rem, 1.2rem + 9vw, 8.5rem)` → 52–136px | 700 | 0.92 | −0.04em | Hero only. One per page. |
| **H1** | Space Grotesk | `clamp(2.5rem, 1.4rem + 4.8vw, 5.25rem)` → 40–84px | 700 | 0.96 | −0.035em | Page titles when there is no hero display. |
| **H2** | Space Grotesk | `clamp(2rem, 1.4rem + 2.6vw, 3.5rem)` → 32–56px | 600 | 1.02 | −0.03em | Section headings. |
| **H3** | Space Grotesk | `clamp(1.5rem, 1.2rem + 1.3vw, 2.25rem)` → 24–36px | 600 | 1.1 | −0.022em | Subsections, project card titles. |
| **H4** | Space Grotesk | `clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)` → 20–24px | 600 | 1.2 | −0.015em | Card titles, modal titles. |
| **H5** | IBM Plex Sans | `1.125rem` → 18px | 600 | 1.35 | −0.008em | Inline headings inside prose. |
| **H6** | IBM Plex Sans | `1rem` → 16px | 600 | 1.4 | 0 | Rarely used. Prefer eyebrow. |
| **Body large** | IBM Plex Sans | `clamp(1.0625rem, 1rem + 0.3vw, 1.25rem)` → 17–20px | 400 | 1.6 | −0.005em | Hero paragraph, section intros. Max 60ch. |
| **Body** | IBM Plex Sans | `1.0625rem` → 17px | 400 | 1.65 | 0 | Default. Max 68ch. |
| **Body small** | IBM Plex Sans | `0.875rem` → 14px | 400 | 1.55 | 0.005em | Captions, helper text, footnotes. |
| **Navigation** | Space Grotesk | `0.9375rem` → 15px | 500 | 1 | −0.01em | Nav links. Sentence case. |
| **Button label** | Space Grotesk | `0.9375rem` → 15px (lg: `1rem`) | 600 | 1 | 0 | Sentence case. 1–3 words. |
| **Eyebrow** | Space Mono | `0.75rem` → 12px | 400 | 1.2 | 0.14em | UPPERCASE. Always paired with a heading below. |
| **Caption / meta** | Space Mono | `0.75rem` → 12px | 400 | 1.4 | 0.06em | Image credits, project year, role labels. |
| **Overline number** | Space Mono | `0.6875rem` → 11px | 700 | 1 | 0.1em | Only when content is a real sequence. |

### 3.3 Typographic rules

- **Optical sizing at display scale.** Anything ≥ 64px gets `letter-spacing: -0.04em` and
  `text-wrap: balance`. Large type needs tightening; body type does not.
- **Manual line breaks in the hero.** The hero headline wraps into 2–3 deliberate lines.
  Use `<br>` inside a `@media (min-width: 1024px)` — controlled via a `.br-lg` utility that
  is `display: none` below `lg`. Never let a display headline wrap arbitrarily.
- **Measure.** Body copy is capped at 68ch, intro copy at 60ch. Enforce with
  `max-width: var(--measure)`, not with grid column counts alone.
- **Case.** Sentence case everywhere except eyebrows and mono metadata. No ALL CAPS
  headlines, no title case in buttons.
- **Numerals.** `font-variant-numeric: tabular-nums` in tables, stats, and pricing.
- **Never** use more than three type sizes in a single component.

---

## 4. Spacing and layout

### 4.1 Spacing scale

Base unit **4px**. Named by multiplier, not by t-shirt size — it removes the argument
about what "lg" means.

| Token | px | rem | Typical use |
|---|---|---|---|
| `--space-1` | 4 | 0.25 | Icon-to-label gap. |
| `--space-2` | 8 | 0.5 | Tag padding, tight inline gaps. |
| `--space-3` | 12 | 0.75 | Input inner padding (vertical). |
| `--space-4` | 16 | 1 | Default small gap; button padding (vertical). |
| `--space-5` | 20 | 1.25 | Card inner padding (mobile). |
| `--space-6` | 24 | 1.5 | Grid gutter; minimum gap between unrelated elements. |
| `--space-8` | 32 | 2 | Card inner padding (desktop); stack gap in forms. |
| `--space-10` | 40 | 2.5 | Gap between a heading and its body copy at H2. |
| `--space-12` | 48 | 3 | Component group spacing. |
| `--space-16` | 64 | 4 | Minimum section padding (mobile). |
| `--space-20` | 80 | 5 | Section padding (tablet). |
| `--space-24` | 96 | 6 | Section padding (small desktop). |
| `--space-32` | 128 | 8 | Section padding (desktop). Default rhythm. |
| `--space-40` | 160 | 10 | Major section break; before the footer. |
| `--space-48` | 192 | 12 | Rare. Hero-to-first-section on large desktop. |

Do not use values outside this scale. If something needs 30px, it needs 32px.

### 4.2 Container and page padding

| Token | Value | Notes |
|---|---|---|
| `--container-max` | `1440px` | Main content container. |
| `--container-wide` | `1680px` | Full-bleed-ish artwork sections only. |
| `--container-text` | `760px` | Article and long-form pages. |
| `--measure` | `68ch` | Body copy cap. |
| `--measure-intro` | `60ch` | Intro/lede cap. |

| Breakpoint | Page padding (`--page-pad`) |
|---|---|
| ≥ 1440px | `--space-16` (64px) |
| 1024–1439px | `--space-12` (48px) |
| 768–1023px | `--space-8` (32px) |
| 480–767px | `--space-6` (24px) |
| < 480px | `--space-5` (20px) |

```css
.container {
  width: 100%;
  max-width: var(--container-max);
  margin-inline: auto;
  padding-inline: var(--page-pad);
}
```

### 4.3 Grid

| Breakpoint | Columns | Gutter | Behavior |
|---|---|---|---|
| ≥ 1280px | 12 | `--space-6` (24px) | Full editorial grid. Asymmetric spans encouraged. |
| 1024–1279px | 12 | `--space-6` (24px) | Same grid, tighter page padding. |
| 768–1023px | 8 | `--space-5` (20px) | Two-up cards; hero becomes stacked. |
| 480–767px | 4 | `--space-4` (16px) | Single-column flow. |
| < 480px | 4 | `--space-4` (16px) | Single-column flow. |

```css
.grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols), minmax(0, 1fr));
  gap: var(--grid-gap);
}
```

**Row gap vs column gap.** Vertical gaps inside a grid section use `--space-12` or larger,
not the gutter value. Cards that sit 24px apart horizontally and 24px apart vertically read
as a spreadsheet.

### 4.4 Vertical rhythm

| Relationship | Spacing |
|---|---|
| Eyebrow → heading | `--space-3` (12px) |
| Display/H1 → paragraph | `--space-6` (24px) |
| H2 → paragraph | `--space-5` (20px) |
| Paragraph → CTA | `--space-8` (32px) |
| Heading block → content grid | `--space-12` to `--space-16` |
| Section → section | `--space-32` desktop / `--space-16` mobile |
| Last section → footer | `--space-40` |

### 4.5 Hero proportions

- Artwork panel: `min-height: clamp(360px, 52vh, 680px)`, width = full container.
- Artwork aspect ratio: **16:9** desktop, **4:3** tablet, **3:4** mobile. Ship separate
  crops; do not `object-fit` a landscape crop into a portrait box and hope.
- The hero artwork's bottom edge should sit near the fold: aim for the headline's first
  line to be *just* visible at 900px viewport height, which invites the scroll.
- Content block below artwork: headline spans **columns 1–7**, description + CTA span
  **columns 9–12**. The empty column 8 is the asymmetry.

### 4.6 Alignment

- Everything is left-aligned. No centered body copy, no centered headlines.
- Centering is reserved for: the nav bar itself, modal dialogs, and a single optional
  closing statement before the footer.
- Optical alignment beats mathematical alignment for large type — a display headline may
  need `margin-left: -0.06em` to align its stem with the column edge above it.

---

## 5. Borders, radius, and shadows

### 5.1 Borders

| Token | Value | Use |
|---|---|---|
| `--border-hairline` | `1px solid var(--color-border)` | Card outlines, input rest state, page frame. |
| `--border-strong` | `1px solid var(--color-border-strong)` | Input hover, table rules, emphasized dividers. |
| `--border-ink` | `1.5px solid var(--color-ink)` | Secondary button outline. |
| `--border-inverse` | `1px solid var(--color-border-inverse)` | Dividers on dark surfaces. |
| `--divider` | `1px solid var(--color-border)` | `<hr>` and section rules. Full container width. |

Borders are always 1px (1.5px for the secondary button, which needs the weight). Never 2px
or 3px. On high-DPI screens, 1px is already a visible, deliberate hairline.

### 5.2 Radius

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | `4px` | Tags, checkboxes, small chips. |
| `--radius-sm` | `8px` | Inputs, selects, textareas, tooltips. |
| `--radius-md` | `16px` | Cards, modals, dropdown panels. |
| `--radius-lg` | `28px` | Large image panels, project cards, feature blocks. |
| `--radius-hero` | `32px` | Hero artwork panel. |
| `--radius-pill` | `999px` | Buttons, nav bar, nav CTA, filter chips. |

**One radius per component.** Do not nest a `--radius-md` card inside a `--radius-lg`
container with a `--radius-sm` image inside that. Pick the outer radius and step the inner
one down by exactly one level, or match it.

### 5.3 Shadows

Shadows are used in three places only: the floating nav, elevated overlays, and card hover.
Everything else uses borders.

| Token | Value | Use |
|---|---|---|
| `--shadow-nav` | `0 2px 6px -2px rgba(26,25,23,0.14), 0 12px 32px -14px rgba(26,25,23,0.42)` | Floating nav bar. Two layers: a tight contact shadow and a soft ambient one. |
| `--shadow-card` | `none` | Cards at rest use a border, not a shadow. |
| `--shadow-card-hover` | `0 1px 2px rgba(26,25,23,0.06), 0 16px 36px -20px rgba(26,25,23,0.28)` | Card hover only. |
| `--shadow-overlay` | `0 4px 12px -4px rgba(26,25,23,0.16), 0 32px 64px -24px rgba(26,25,23,0.36)` | Modals, dropdowns, popovers. |
| `--shadow-focus` | `0 0 0 3px var(--color-bg), 0 0 0 5px var(--color-focus)` | Focus ring: 3px background gap, then a 2px ring. |
| `--shadow-focus-inverse` | `0 0 0 3px var(--color-ink), 0 0 0 5px var(--color-focus-inverse)` | Focus ring on dark surfaces. |

All shadows are warm-neutral (`rgba(26,25,23,…)`), never blue-gray. A cool shadow on a warm
paper canvas looks like a bug.

---

## 6. Navigation

### 6.1 Desktop (≥ 1024px)

A single dark pill floating over the page.

```
┌────────────────────────────────────────────────────────────────┐
│  ●  Longwave      Work   Studio   Services   Journal   [ Start a project ] │
└────────────────────────────────────────────────────────────────┘
```

**Structure and metrics**

| Property | Value |
|---|---|
| Position | `sticky`, `top: var(--space-6)`, `z-index: 100` |
| Container | Centered, `max-width: min(1180px, calc(100% - var(--page-pad) * 2))` |
| Background | `--color-ink` `#1A1917` |
| Radius | `--radius-pill` |
| Height | `64px` (inner padding `--space-3` vertical, `--space-3` left, `--space-3` right) |
| Left padding | `--space-6` (24px) for the logo |
| Right padding | `--space-3` (12px) — the CTA pill provides the optical margin |
| Shadow | `--shadow-nav` |
| Border | `1px solid rgba(255,255,255,0.06)` — catches the top edge, keeps it from looking pasted on |
| Layout | `display: grid; grid-template-columns: 1fr auto 1fr; align-items: center` |
| Link group gap | `--space-8` (32px) |

Three tracks rather than a flex row with an auto-margin group: the right zone carries a
toggle *and* the CTA, so it no longer weighs what the wordmark does, and only equal side
tracks keep the links centered on the bar instead of on whatever space is left over.

**Logo (left).** Wordmark in Space Grotesk 600, 17px, `--color-text-inverse`, with an 8px
mark to its left at `--color-ink-amber`. Total block height 24px.

**Links (center).** Navigation style (15px / 500 / Space Grotesk).

| State | Treatment |
|---|---|
| Default | `--color-text-inverse-muted` `#A5A096` |
| Hover | `--color-text-inverse`, transition `color var(--duration-fast) var(--ease-standard)` |
| Current section | `--color-text-inverse` + the marker below |
| Focus-visible | `--shadow-focus-inverse`, `border-radius: var(--radius-pill)`, `padding-inline: var(--space-2)` |
| Pressed | `opacity: 0.7` |

**The current-section marker.** A 2px `--color-ink-amber` rule, inset to the link's text
box, sitting 8px below the baseline. It is a *single element* that travels between links —
one shared layout ID, `--duration-slow` on `--ease-out` — never one marker per link fading
in and out.

This is a deliberate exception to the restraint principle, and it is only earned because
the links point at sections of the page the reader is already on: the marker is reporting
where they are as they scroll, not decorating a click. It is driven by an observer
watching which section crosses the middle of the viewport, and it carries
`aria-current="location"` — "page" would claim a navigation that never happened. On a nav
whose links lead somewhere else, use a static marker; a marker that slides between
destinations the reader has not visited is the flourish this document otherwise refuses.

The mobile sheet (§6.3) marks the same section with a plain amber dot and no movement:
the sheet is a list that has just opened, so there is no journey for a moving marker to
describe.

**Theme toggle (right, before the CTA).** A 44px icon button, no fill at rest,
`--color-text-inverse-muted` → `--color-text-inverse` with a `--color-ink-soft` fill on
hover. One control, two states, no menu: it writes an explicit light or dark and gives up
following the OS from then on (§2.6). Which glyph shows is decided in CSS off
`[data-theme]`, not in JS — the theme is not knowable on the server, and an icon that
appears only after hydration is a visible flash of nothing.

**CTA (right).** Light pill on the dark bar.

| State | Background | Text |
|---|---|---|
| Default | `--color-text-inverse` `#FBFAF6` | `--color-ink` |
| Hover | `--color-text-inverse-strong` `#FFFFFF`, `transform: translateY(-1px)` | `--color-ink` |
| Active | `transform: translateY(0)` | `--color-ink` |
| Focus-visible | `--shadow-focus-inverse` | — |

The fill is the inverse-*text* token rather than the page background. They hold the same
hex on light, but the ink surfaces stay dark under the dark theme (§2.6) — a `--color-bg`
pill would vanish into the bar it sits on.

Height 40px, padding `0 var(--space-5)`, `--radius-pill`, button label type.

**Scroll behavior.** The bar is sticky from the first pixel and never shrinks. Its ambient
shadow layer ramps its alpha from 0.42 to 0.5 as a continuous read of the scroll offset —
no threshold, so nothing can strobe at a boundary.

Past 96px — its own height plus the top gap, inside which the page still reads as "the
top" — the bar retracts on a downward scroll and returns on any upward one, blurring
slightly as it travels so the movement reads as speed rather than a jump cut. Retraction
is a transform, so it is off entirely under `prefers-reduced-motion` (§10.6): a bar that
teleported out of frame would be worse than one that simply stayed.

### 6.2 Tablet (768–1023px)

Same pill, but the center link group collapses to the three highest-value links (Work,
Services, Contact) and the CTA label shortens to "Start". If more than three links are
required by IA, use the mobile pattern instead — a cramped desktop nav is worse than a
menu.

### 6.3 Mobile (< 768px)

**Collapsed header**

| Property | Value |
|---|---|
| Position | `sticky`, `top: var(--space-4)` |
| Width | `calc(100% - var(--page-pad) * 2)` |
| Height | `56px` |
| Contents | Logo left, menu trigger right |
| Trigger | 44 × 44px, two 18px bars, `--color-text-inverse` |

**Expanded menu — bottom sheet**

- Slides up from the bottom edge. `--color-ink` background, `--radius-lg` on the top two
  corners only, full width, height `auto` capped at `85dvh`.
- Links stack at H4 size (20–24px), Space Grotesk 600, `--color-text-inverse`, one per row,
  `--space-5` vertical padding, separated by `--border-inverse`.
- Primary CTA sits at the bottom as a full-width pill, `--color-action` background.
- A scrim at `--color-overlay` covers the page behind it.

**Accessibility contract for the mobile menu**

```html
<button aria-expanded="false" aria-controls="site-menu" aria-label="Open menu">…</button>
<nav id="site-menu" aria-label="Main">…</nav>
```

- Toggle `aria-expanded` on open/close, and swap `aria-label` to "Close menu".
- Trap focus inside the sheet while open; return focus to the trigger on close.
- `Escape` closes it.
- Lock body scroll with `overflow: hidden` on `<body>` plus `scrollbar-gutter: stable` to
  prevent the layout jump.
- Every touch target ≥ 44 × 44px.

---

## 7. Hero section

### 7.1 Composition

Five stacked elements, in DOM order:

1. Floating navigation (overlays, does not consume layout space beyond its sticky offset)
2. Large artwork panel
3. Content area below the artwork
4. Oversized headline, left
5. Supporting paragraph + CTA, right

### 7.2 Desktop structure (≥ 1024px)

```
│←────────────────── container 1440 ──────────────────→│
┌──────────────────────────────────────────────────────┐
│                                                      │
│                  HERO  ARTWORK                       │  ← 16:9, radius 32px
│              (spans all 12 columns)                  │     min 360 / 52vh / max 680
│                                                      │
└──────────────────────────────────────────────────────┘
                        ↕ --space-16 (64px)
┌───────────────────────────────┐   ┐  ┌───────────────┐
│ WE BUILD BRANDS               │   │  │ Longwave is a │  ← body large,
│ THAT LOOK LIKE                │   │  │ brand and     │     max 60ch
│ SOMEWHERE ELSE.               │   │  │ motion studio…│
│                               │   │  │               │
│  cols 1–7, display size       │  gap │  ( See the work ) ← primary pill
└───────────────────────────────┘  col8 └──────────────┘
                                        cols 9–12
```

**Metrics**

| Element | Spec |
|---|---|
| Nav offset above artwork | `--space-24` (96px) from top of viewport to artwork top |
| Artwork | `grid-column: 1 / -1`, `aspect-ratio: 16/9`, `border-radius: var(--radius-hero)`, `overflow: hidden` |
| Artwork → content gap | `--space-16` (64px) |
| Headline | `grid-column: 1 / 8`, Display style, `text-wrap: balance` off (use manual breaks) |
| Right block | `grid-column: 9 / -1`, `align-self: end` — the paragraph baseline aligns to the headline's last line |
| Paragraph | Body large, `--color-text-secondary`, max `--measure-intro` |
| Paragraph → CTA | `--space-8` (32px) |
| Hero → next section | `--space-40` (160px) |

**The asymmetry.** Column 8 is deliberately empty and the right block is bottom-aligned
while the left block is top-aligned. That mismatch is what keeps it from reading as a
two-column template. Do not "fix" it by centering.

### 7.3 Headline treatment

- 2–3 lines. Three is the target on desktop.
- Line lengths should be visibly uneven — roughly 90% / 100% / 65% of the column width.
  A perfectly rectangular block of display type looks like a mistake at this scale.
- One word may take `--color-ink-coral-deep` for emphasis. **One word, one page.** If you
  use it in the hero you do not use it again.

### 7.4 Mobile structure (< 768px)

Straight vertical flow, no exceptions:

1. Nav (56px sticky header)
2. Artwork — 3:4 crop, `--radius-md` (16px; the 32px radius is too round at this width),
   full bleed to page padding
3. Headline — `--space-10` (40px) below artwork, 2 lines max, `clamp` bottoms out at 52px
4. Paragraph — `--space-6` (24px) below headline
5. CTA — `--space-8` (32px) below paragraph, full-width pill up to 400px

---

## 8. Image and illustration direction

### 8.1 What the work looks like

Every hero and section image should read as a **screen-printed poster**, not a photograph
and not a render.

| Attribute | Direction |
|---|---|
| Subject | Surreal landscapes. Horizons, monoliths, roads, water, distant architecture, celestial bodies. Human figures appear as silhouettes, never as faces. |
| Sky | Graphic, not atmospheric. Flat bands, hard-edged suns, concentric arcs, gradients rendered as halftone steps rather than smooth blends. |
| Palette | 3–4 inks maximum from §2.3, plus paper and charcoal. Overprint where two inks cross — the third color should look like ink sitting on ink. |
| Scale | Dramatic. One element should be implausibly large relative to another. This is the retro-futurist signature. |
| Texture | Visible halftone dot at 45°, 60–85 LPI equivalent. Fine paper grain over the whole image. |
| Registration | 0.5–1.5px color separation on one ink only. Any more and it reads as a rendering error. |
| Composition | One clear focal point, high negative space, poster-like. The image should survive being cropped to a square thumbnail. |
| Contrast | Strong. The image is the loudest thing on the page and must hold up against a 136px headline. |

### 8.2 Production notes

- Build assets as **vector + raster hybrid**: flat shapes in vector, halftone and grain
  applied as a raster layer, exported flattened.
- Halftone should be baked into the asset, not applied in CSS. CSS halftone over a photo
  looks like a filter; baked halftone looks printed.
- Maintain a shared **texture library**: one grain plate, one halftone plate, one paper
  fiber plate, reused across all assets. This is what makes twelve images look like one
  press run.
- Export a **dominant color** value per image for the LQIP placeholder (see §14.6).

### 8.3 Avoid

- Generic corporate stock photography — smiling teams, laptops, handshakes.
- Glossy 3D blobs, chrome spheres, soft-body renders.
- Multi-stop mesh gradients and "aurora" backgrounds.
- Neon cyberpunk: no magenta-on-cyan, no glow, no rain-slick streets.
- Random floating decorative shapes with no compositional role.
- Over-smooth AI imagery with no grain, no registration error, no texture.
- Illustrations busy enough to compete with the headline. If the eye does not know where
  to land, the image has failed regardless of quality.
- Text baked into images (see §12.9).

### 8.4 Alt text

Describe the image's *content and function*, not its style. "A lone figure walking toward
an oversized coral sun above a flat blue horizon" — not "hero illustration" and not
"halftone risograph poster with grain."

---

## 9. Components

Every interactive component defines: default, hover, active, focus-visible, disabled, and
loading. Error states where the component can hold invalid input.

Universal rules:

- `:focus-visible` uses `--shadow-focus` (or `--shadow-focus-inverse` on dark). Never
  `outline: none` without a replacement.
- Disabled: `opacity: 0.45`, `cursor: not-allowed`, `pointer-events: none` on the inner
  content only — keep the element focusable if it carries an explanation.
- Transitions apply to `color`, `background-color`, `border-color`, `box-shadow`,
  `transform`, `opacity`. Never to `all`.
- Minimum interactive target: 44 × 44px (visual size may be smaller if padding fills it).

### 9.1 Primary button

Pill, filled, deep blue. One per view.

| Property | Value |
|---|---|
| Height | `48px` (lg: `56px`, sm: `40px`) |
| Padding | `0 var(--space-6)` (lg: `0 var(--space-8)`) |
| Radius | `--radius-pill` |
| Type | Button label (Space Grotesk 600, 15px) |
| Background | `--color-action` |
| Text | `#FFFFFF` |

| State | Treatment |
|---|---|
| Hover | `background: var(--color-action-hover)`; `transform: translateY(-1px)` |
| Active | `background: var(--color-action-active)`; `transform: translateY(0)` |
| Focus-visible | `--shadow-focus` |
| Disabled | `background: var(--color-border-strong)`; text `--color-text-muted`; no transform |
| Loading | Label stays in place at `opacity: 0`, a 16px spinner centers over it. Width is locked with `min-width` captured before the state change. `aria-busy="true"`, `aria-disabled="true"`. |

### 9.2 Secondary button

Pill, outlined, ink.

| State | Treatment |
|---|---|
| Default | `background: transparent`; `border: var(--border-ink)`; text `--color-text-primary` |
| Hover | `background: var(--color-ink)`; text `--color-text-inverse` |
| Active | `background: var(--color-ink-soft)` |
| Focus-visible | `--shadow-focus` |
| Disabled | `border-color: var(--color-border)`; text `--color-text-muted` |
| Loading | As primary; spinner uses `currentColor` |

Same metrics as primary. Note the 1.5px border requires `box-sizing: border-box` and a
compensating `padding-block` so both buttons sit on the same baseline.

### 9.3 Tertiary / text link (in-content)

| State | Treatment |
|---|---|
| Default | `color: var(--color-text-primary)`; `text-decoration: underline`; `text-underline-offset: 0.18em`; `text-decoration-thickness: 1px`; `text-decoration-color: var(--color-border-strong)` |
| Hover | `text-decoration-color: var(--color-action)`; `color: var(--color-action)` |
| Active | `color: var(--color-action-active)` |
| Focus-visible | `--shadow-focus`, `border-radius: var(--radius-xs)` |
| Visited | No distinct style on marketing pages; on the journal index, `--color-text-secondary` |

Links in body copy are always underlined. Color alone is not an affordance (§12).

### 9.4 Navigation link

See §6.1. Summary: muted → inverse on hover, a travelling amber rule under the current
section, pill-shaped focus ring.

### 9.5 Card (base)

| Property | Value |
|---|---|
| Background | `--color-bg` (or `--color-surface` when the section background is `--color-bg`) |
| Border | `--border-hairline` |
| Radius | `--radius-md` |
| Padding | `--space-8` desktop / `--space-5` mobile |
| Shadow | `--shadow-card` (none) |

| State | Treatment |
|---|---|
| Hover (if linked) | `border-color: var(--color-border-strong)`; `box-shadow: var(--shadow-card-hover)`; `transform: translateY(-2px)` |
| Active | `transform: translateY(0)` |
| Focus-visible | `--shadow-focus` on the card's anchor, not the card div |

**Whole-card links.** Use a real `<a>` around the title and stretch it with a pseudo-element
(`a::after { position: absolute; inset: 0; }`). Do not attach `onClick` to a `<div>`.

### 9.6 Project card

The one card type that carries artwork.

| Property | Value |
|---|---|
| Image | `aspect-ratio: 4/3`, `--radius-lg`, `overflow: hidden` |
| Container | No border, no background, no padding. The image *is* the card. |
| Meta row | Below image, `--space-5` gap. Eyebrow (client + year, Space Mono) then H3 title. |
| Description | Body small, `--color-text-secondary`, 2 lines max with `line-clamp` |

| State | Treatment |
|---|---|
| Hover | Image `transform: scale(1.03)` over `--duration-slow`; title `color: var(--color-action)` |
| Active | `scale(1.01)` |
| Focus-visible | `--shadow-focus` on the wrapping anchor, `border-radius: var(--radius-lg)` |
| Loading | Skeleton: flat `--color-surface` block at the correct aspect ratio, no shimmer animation |

Grid: 2-up on desktop with a staggered vertical offset (`:nth-child(even) { margin-top: var(--space-16) }`) — this is the editorial move that stops the work grid from looking like a product listing. 1-up below 768px, offset removed.

### 9.7 Service card

Text-only. No icons — icon sets are the fastest route to looking templated.

| Property | Value |
|---|---|
| Layout | Number (overline, Space Mono, `--color-text-muted`) → H4 title → body small |
| Border | Top rule only: `border-top: var(--border-hairline)`, `padding-top: var(--space-6)` |
| Background | None |
| Hover | Top rule shifts to `--color-ink`; title unchanged |

Numbering is permitted here **only if the services describe a real sequence** (discovery →
strategy → identity → rollout). If they are a menu of parallel offerings, drop the numbers.

### 9.8 Testimonial block

| Property | Value |
|---|---|
| Quote | H3 size, Space Grotesk 500, `--color-text-primary`, max 20 words |
| Attribution | Body small, `--color-text-muted`, `--space-6` below quote |
| Container | `--color-surface` background, `--radius-lg`, `--space-12` padding desktop |
| Quote mark | None. No oversized decorative quotation marks. |
| Photo | Optional 40px circle in the attribution row, or nothing |

Maximum one testimonial per section. A carousel of three is a carousel nobody reads.

### 9.9 Tag / filter chip

| State | Background | Border | Text |
|---|---|---|---|
| Default | `transparent` | `--border-hairline` | `--color-text-secondary` |
| Hover | `--color-surface` | `--color-border-strong` | `--color-text-primary` |
| Selected | `--color-action-subtle` | `1px solid var(--color-action)` | `--color-action`, weight 600 |
| Active | `--color-action-subtle`, `transform: scale(0.98)` | — | — |
| Focus-visible | — | — | `--shadow-focus` |
| Disabled | `transparent` | `--border-hairline` | `--color-text-muted`, `opacity: 0.5` |

Height 32px, padding `0 var(--space-4)`, `--radius-pill`, body small type. Selected state
changes fill *and* weight — never color alone.

### 9.10 Text input

| Property | Value |
|---|---|
| Height | `48px` |
| Padding | `0 var(--space-4)` |
| Radius | `--radius-sm` (8px) |
| Background | `--color-surface` |
| Border | `--border-hairline` |
| Type | Body (17px) — **never below 16px**, or iOS zooms on focus |
| Label | Body small, weight 500, `--color-text-primary`, `--space-2` above the field |

| State | Treatment |
|---|---|
| Hover | `border-color: var(--color-border-strong)` |
| Focus-visible | `background: var(--color-bg)`; `border-color: var(--color-action)`; `--shadow-focus` |
| Filled | `background: var(--color-bg)` |
| Disabled | `background: var(--color-surface)`; `opacity: 0.5`; text `--color-text-muted` |
| Error | `border-color: var(--color-error)`; message below in `--color-error`, body small, prefixed with a 14px alert icon; `aria-invalid="true"`, `aria-describedby` pointing at the message |
| Loading (async validation) | 16px spinner inset right, `aria-busy="true"` |

Placeholder text is `--color-text-muted` and is **never a substitute for a label**.

### 9.11 Textarea

Inherits input styling. `min-height: 140px`, `padding: var(--space-3) var(--space-4)`,
`resize: vertical`, `line-height: 1.6`. A character counter, if present, sits bottom-right
in Space Mono 12px `--color-text-muted`, turning `--color-error` at 100%.

### 9.12 Select

Inherits input styling. Custom chevron (12px, `--color-text-muted`) at `--space-4` from the
right edge; `appearance: none`; `padding-right: var(--space-10)`.

| State | Treatment |
|---|---|
| Open | `border-color: var(--color-action)`; chevron rotates 180° over `--duration-fast` |
| Option hover | `background: var(--color-surface)` |
| Option selected | `background: var(--color-action-subtle)`; weight 500 |

Prefer a native `<select>` unless the design requires multi-select or search. If custom,
implement the full ARIA combobox pattern — arrow keys, Home/End, type-ahead, Escape.

### 9.13 Modal

| Property | Value |
|---|---|
| Element | Native `<dialog>` with `showModal()` |
| Width | `min(560px, calc(100vw - var(--space-8) * 2))` |
| Background | `--color-surface-raised` `#FFFFFF` |
| Radius | `--radius-md` |
| Padding | `--space-10` desktop / `--space-6` mobile |
| Shadow | `--shadow-overlay` |
| Scrim | `--color-overlay`, via `::backdrop` |
| Entrance | Fade + `translateY(8px) → 0` over `--duration-base`, `--ease-out` |
| Exit | Fade over `--duration-fast` |

Focus moves to the dialog on open and returns to the trigger on close. `Escape` closes.
Close button is 44 × 44px, top-right, `aria-label="Close dialog"`. Body scroll locked.
On mobile (< 640px), the modal becomes a bottom sheet with `--radius-lg` top corners.

### 9.14 Tooltip

| Property | Value |
|---|---|
| Background | `--color-ink` |
| Text | `--color-text-inverse`, body small (14px) |
| Padding | `var(--space-2) var(--space-3)` |
| Radius | `--radius-sm` |
| Max width | `240px` |
| Delay | 400ms in, 100ms out |
| Offset | 8px from trigger |

Tooltips must appear on **keyboard focus**, not just hover, and must be dismissible with
`Escape`. Never put essential information or interactive elements in a tooltip. Use
`aria-describedby`, not `title`.

### 9.15 Footer

| Property | Value |
|---|---|
| Background | `--color-ink` |
| Text | `--color-text-inverse` / `--color-text-inverse-muted` |
| Radius | `--radius-lg` on the top two corners, sits inside the page container with `--page-pad` gutters |
| Padding | `--space-24` top, `--space-12` bottom desktop |
| Grid | 12 columns. Statement (cols 1–5, H2 size) · link columns (7–9, 10–12) |
| Divider | `--border-inverse` above the bottom row |
| Bottom row | Copyright + legal links, body small, `--color-text-inverse-muted` |

Links in the footer follow §9.4 nav link states with `--shadow-focus-inverse` on focus.
The footer carries the second CTA of the page — always the same label and destination as
the nav CTA.

---

## 10. Motion

### 10.1 Duration and easing tokens

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | `100ms` | Tooltip dismiss, pressed states. |
| `--duration-fast` | `160ms` | Color, border, opacity changes on hover. |
| `--duration-base` | `220ms` | Transforms, modal entrance, menu toggle. |
| `--duration-slow` | `320ms` | Image scale on hover, dropdown expansion. |
| `--duration-entrance` | `560ms` | Section reveal on scroll. |
| `--duration-hero` | `700ms` | Hero artwork and headline on page load. |
| `--ease-standard` | `cubic-bezier(0.2, 0.6, 0.2, 1)` | Default. Fast start, gentle settle. |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances. |
| `--ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits. |
| `--ease-linear` | `linear` | Spinners and progress only. |

UI interactions land in the 150–250ms band. Section entrances land in 400–700ms.

### 10.2 The page-load sequence

One orchestrated moment. It happens once and is never repeated on navigation.

| Step | Element | Delay | Duration | Transform |
|---|---|---|---|---|
| 1 | Nav bar | 0ms | `--duration-base` | `translateY(-12px)` → 0, opacity 0 → 1 |
| 2 | Hero artwork | 80ms | `--duration-hero` | `scale(1.02)` → 1, opacity 0 → 1 |
| 3 | Headline line 1 | 220ms | `--duration-entrance` | `translateY(16px)` → 0, opacity 0 → 1 |
| 4 | Headline lines 2–3 | +70ms each | `--duration-entrance` | same |
| 5 | Paragraph + CTA | 460ms | `--duration-entrance` | `translateY(12px)` → 0 |

Total sequence under 1.2s. Nothing on the page waits for JavaScript to become readable —
the animation runs on top of already-rendered content via a class toggled on `load`, and
the no-JS state is the final state.

### 10.3 Scroll reveals

- Trigger with `IntersectionObserver` at `threshold: 0.15`, `rootMargin: '0px 0px -10% 0px'`.
- Reveal: `opacity 0 → 1`, `translateY(20px) → 0`, `--duration-entrance`, `--ease-out`.
- Stagger grid children by 60ms, capped at 5 items — after that everything arrives together.
- **Reveal once.** Never re-hide on scroll up.

### 10.4 Hover motion

| Element | Motion |
|---|---|
| Project card image | `scale(1.03)`, `--duration-slow`, `--ease-standard` |
| Buttons | `translateY(-1px)`, `--duration-fast` |
| Cards | `translateY(-2px)` + shadow, `--duration-base` |
| Nav links | Color only |

Image scale happens on the `<img>` inside an `overflow: hidden` parent — never on the
parent itself, which would clip the shadow and force a repaint of neighbors.

### 10.5 Prohibited

- Parallax beyond 6px of differential travel.
- Scroll-jacking or scroll-driven horizontal sections.
- Text that animates letter-by-letter.
- Anything that moves while it is being read.
- Infinite ambient animation in the viewport during reading.
- Motion on `width`, `height`, `top`, `left`, or `margin`. Animate `transform` and
  `opacity` only.

### 10.6 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Beyond the blanket rule: reveal animations must set their final state immediately (elements
must never be left at `opacity: 0`), the hover image scale is removed entirely, and the
page-load sequence is skipped. Test by running the whole site with reduced motion forced —
if anything is invisible or unreachable, it is a bug, not a preference.

---

## 11. Responsive behavior

### 11.1 Breakpoints

| Name | Range | Token |
|---|---|---|
| Large desktop | ≥ 1440px | `--bp-2xl: 1440px` |
| Desktop | 1024–1439px | `--bp-xl: 1280px` / `--bp-lg: 1024px` |
| Tablet | 768–1023px | `--bp-md: 768px` |
| Mobile | 480–767px | `--bp-sm: 480px` |
| Small mobile | < 480px | — |

Mobile-first. All media queries are `min-width`.

### 11.2 Adaptation table

| | Large desktop | Desktop | Tablet | Mobile | Small mobile |
|---|---|---|---|---|---|
| **Container** | 1440px, 64px pad | fluid, 48px pad | fluid, 32px pad | fluid, 24px pad | fluid, 20px pad |
| **Grid** | 12 col / 24px | 12 col / 24px | 8 col / 20px | 4 col / 16px | 4 col / 16px |
| **Display type** | 136px | 96–120px | 72–88px | 56–68px | 52px |
| **H2** | 56px | 44–52px | 38px | 32px | 30px |
| **Body** | 17px | 17px | 17px | 17px | 16px |
| **Nav** | Full pill, 5 links + CTA | Full pill, 5 links + CTA | Pill, 3 links + short CTA | Header + bottom sheet | Header + bottom sheet |
| **Hero artwork** | 16:9, radius 32 | 16:9, radius 32 | 4:3, radius 24 | 3:4, radius 16 | 3:4, radius 16 |
| **Hero layout** | Headline 1–7, copy 9–12 | Headline 1–7, copy 9–12 | Headline full, copy full below | Stacked | Stacked |
| **Section padding** | 128px | 96–128px | 80px | 64px | 64px |
| **Project grid** | 2-up staggered | 2-up staggered | 2-up flat | 1-up | 1-up |
| **Service cards** | 3-up | 3-up | 2-up | 1-up | 1-up |
| **Footer** | 12 col, 3 groups | 12 col, 3 groups | 8 col, 2 groups | Stacked accordion | Stacked accordion |
| **CTA** | Inline pill, auto width | Inline pill | Inline pill | Full-width, max 400px | Full-width |

### 11.3 Rules

- **Never hide content responsively.** If it does not matter on mobile it does not matter on
  desktop. Reorder or collapse, do not `display: none`.
- Use `dvh` not `vh` for any full-height measure — mobile browser chrome makes `vh` wrong.
- Test at 320px width. It should not break, only compress.
- Test at 200% browser zoom on desktop, which is roughly the 640px layout — required for
  WCAG 1.4.4.
- Test in landscape on a 700 × 380 viewport. The hero must not require scrolling to reach
  the headline.

---

## 12. Accessibility

Target: **WCAG 2.2 Level AA**, with AAA text contrast wherever the palette allows.

### 12.1 Color contrast

| Requirement | Threshold | Status |
|---|---|---|
| Body text on `--color-bg` | 4.5:1 | 16.4:1 ✅ |
| Secondary text | 4.5:1 | 8.9:1 ✅ |
| Muted text (smallest permitted) | 4.5:1 | 4.9:1 ✅ |
| White on `--color-action` | 4.5:1 | 8.7:1 ✅ |
| Inverse muted on `--color-ink` | 4.5:1 | 5.9:1 ✅ |
| UI borders, focus indicators | 3:1 | `--color-action` on bg: 8.7:1 ✅ |
| Large display type | 3:1 | 16.4:1 ✅ |

Coral, amber, and green **fail** as text on the canvas. Their `-deep` variants exist for
exactly this reason. This is checked in CI, not by eye.

### 12.2 Keyboard navigation

- Every interactive element is reachable via `Tab` in DOM order.
- No positive `tabindex` values, ever.
- A skip link is the first focusable element:
  `<a href="#main" class="skip-link">Skip to content</a>` — visually hidden until focused,
  then rendered as a pill in the top-left at `z-index: 200`.
- Because the nav is `position: sticky`, add `scroll-margin-top: 88px` to all anchor
  targets so focused elements are not hidden beneath it.
- Modal and mobile menu trap focus and restore it on close.

### 12.3 Focus states

- `:focus-visible` only — no focus ring on mouse click, always on keyboard.
- Ring is `--shadow-focus`: a 3px background-colored gap plus a 2px `--color-action` ring.
  This reads clearly on both light and image backgrounds.
- Focus indicators are never removed, never `outline: 0` without a replacement, and never
  clipped by `overflow: hidden` on a parent — use `outline-offset` or move the ring to a
  wrapper.

### 12.4 Semantic HTML

- One `<h1>` per page. Heading levels never skip.
- `<header>`, `<nav>`, `<main id="main">`, `<section>`, `<article>`, `<footer>`.
- Buttons that do things are `<button>`. Things that navigate are `<a href>`. There is no
  third option.
- Lists are `<ul>` / `<ol>`. Grids of cards are lists.
- Decorative elements get `aria-hidden="true"`.

### 12.5 Navigation labels

```html
<nav aria-label="Main">…</nav>
<nav aria-label="Footer">…</nav>
<a href="/work" aria-current="page">Work</a>
```

`aria-current="page"` is what drives the amber dot in CSS — the visual state and the
programmatic state are the same source of truth.

### 12.6 Touch targets

Minimum 44 × 44px for all interactive elements (WCAG 2.2 AA requires 24 × 24; 44 is the
house rule). Where a control is visually smaller, expand the hit area with padding or a
pseudo-element. Adjacent targets are separated by at least `--space-2`.

### 12.7 Alternative text

- Meaningful images: descriptive `alt` per §8.4.
- Decorative images: `alt=""`.
- SVG icons inside buttons: `aria-hidden="true"` on the SVG, `aria-label` on the button.
- Never `alt="image"` or a filename.

### 12.8 Forms

- Every input has a visible `<label>` with `for` / `id`. Placeholders are not labels.
- Required fields are marked in text, not with a bare asterisk: `Email (required)`.
- Errors are announced: `aria-invalid="true"`, `aria-describedby="field-error"`, and the
  error region is `role="alert"` or `aria-live="polite"`.
- Errors say what is wrong and how to fix it: "Enter an email address that includes an @."
  Not "Invalid input."
- Error styling combines color, an icon, and text — never color alone.
- On submit failure, focus moves to the first invalid field.

### 12.9 Text in images

No essential text is baked into an image — headlines, CTAs, and body copy are always real
DOM text. Logos are the sole exception. This is what makes the site translatable,
selectable, searchable, and zoomable, and it is non-negotiable given how image-forward the
design is.

### 12.10 Motion and other

- Respect `prefers-reduced-motion` (§10.6).
- Content reflows without horizontal scroll at 320px and at 200% zoom.
- Line height ≥ 1.5 for body copy; users can override spacing without breaking layout.
- No content relies on hover alone to be discoverable.
- `<html lang>` set correctly.
- Page titles are unique and descriptive.

---

## 13. Design tokens

```css
:root {
  /* ---------------------------------------------------------------
     COLOR — NEUTRALS
     --------------------------------------------------------------- */
  --color-bg:                    #FBFAF6;
  --color-surface:               #F2EFE7;
  --color-surface-raised:        #FFFFFF;
  --color-ink:                   #1A1917;
  --color-ink-soft:              #2C2A26;

  --color-text-primary:          #1A1917;
  --color-text-secondary:        #4A4740;
  --color-text-muted:            #6E6A60;
  --color-text-inverse:          #FBFAF6;
  --color-text-inverse-muted:    #A5A096;
  --color-text-inverse-strong:   #FFFFFF;   /* light fill on ink, hover (§6.1) */

  --color-border:                #E4DFD4;
  --color-border-strong:         #C6BFB0;
  --color-border-inverse:        #3A3833;

  /* ---------------------------------------------------------------
     COLOR — ACTION
     --------------------------------------------------------------- */
  --color-action:                #1B3FA0;
  --color-action-hover:          #16327E;
  --color-action-active:         #102459;
  --color-action-subtle:         #E8EBF7;
  --color-action-ink:            #1A1917;

  /* ---------------------------------------------------------------
     COLOR — ARTWORK INKS
     --------------------------------------------------------------- */
  --color-ink-blue:              #1B3FA0;
  --color-ink-coral:             #F4573D;
  --color-ink-coral-deep:        #C2331D;
  --color-ink-amber:             #FFB227;
  --color-ink-green:             #00A05A;
  --color-ink-green-deep:        #0B7245;

  /* ---------------------------------------------------------------
     COLOR — FEEDBACK & SYSTEM
     --------------------------------------------------------------- */
  --color-focus:                 #1B3FA0;
  --color-focus-inverse:         #FFB227;
  --color-error:                 #C2331D;
  --color-error-surface:         #FBEAE6;
  --color-success:               #0B7245;
  --color-success-surface:       #E6F2EC;
  --color-warning:               #8A5A00;
  --color-warning-surface:       #FDF2DC;
  --color-overlay:               rgb(26 25 23 / 0.56);
  --color-grain:                 rgb(26 25 23 / 0.055);

  /* ---------------------------------------------------------------
     TYPOGRAPHY — FAMILIES
     --------------------------------------------------------------- */
  --font-display: 'Space Grotesk', 'Space Grotesk Fallback', 'Helvetica Neue', Arial, sans-serif;
  --font-body:    'IBM Plex Sans', 'IBM Plex Sans Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:    'Space Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;

  /* ---------------------------------------------------------------
     TYPOGRAPHY — WEIGHTS
     --------------------------------------------------------------- */
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-semibold: 600;
  --weight-bold:     700;

  /* ---------------------------------------------------------------
     TYPOGRAPHY — SIZES (fluid: 360px → 1440px)
     --------------------------------------------------------------- */
  --text-display: clamp(3.25rem, 1.20rem + 9.00vw, 8.50rem);
  --text-h1:      clamp(2.50rem, 1.40rem + 4.80vw, 5.25rem);
  --text-h2:      clamp(2.00rem, 1.40rem + 2.60vw, 3.50rem);
  --text-h3:      clamp(1.50rem, 1.20rem + 1.30vw, 2.25rem);
  --text-h4:      clamp(1.25rem, 1.10rem + 0.60vw, 1.50rem);
  --text-h5:      1.125rem;
  --text-h6:      1rem;
  --text-body-lg: clamp(1.0625rem, 1.00rem + 0.30vw, 1.25rem);
  --text-body:    1.0625rem;
  --text-body-sm: 0.875rem;
  --text-nav:     0.9375rem;
  --text-button:  0.9375rem;
  --text-eyebrow: 0.75rem;
  --text-caption: 0.75rem;
  --text-overline: 0.6875rem;

  /* ---------------------------------------------------------------
     TYPOGRAPHY — LINE HEIGHT & TRACKING
     --------------------------------------------------------------- */
  --leading-display: 0.92;
  --leading-h1:      0.96;
  --leading-h2:      1.02;
  --leading-h3:      1.10;
  --leading-h4:      1.20;
  --leading-tight:   1.35;
  --leading-body:    1.65;
  --leading-relaxed: 1.60;
  --leading-none:    1;

  --tracking-display: -0.04em;
  --tracking-h1:      -0.035em;
  --tracking-h2:      -0.03em;
  --tracking-h3:      -0.022em;
  --tracking-h4:      -0.015em;
  --tracking-tight:   -0.01em;
  --tracking-normal:  0;
  --tracking-wide:    0.06em;
  --tracking-eyebrow: 0.14em;

  /* ---------------------------------------------------------------
     SPACING (4px base)
     --------------------------------------------------------------- */
  --space-1:  0.25rem;   /*   4px */
  --space-2:  0.5rem;    /*   8px */
  --space-3:  0.75rem;   /*  12px */
  --space-4:  1rem;      /*  16px */
  --space-5:  1.25rem;   /*  20px */
  --space-6:  1.5rem;    /*  24px */
  --space-8:  2rem;      /*  32px */
  --space-10: 2.5rem;    /*  40px */
  --space-12: 3rem;      /*  48px */
  --space-16: 4rem;      /*  64px */
  --space-20: 5rem;      /*  80px */
  --space-24: 6rem;      /*  96px */
  --space-32: 8rem;      /* 128px */
  --space-40: 10rem;     /* 160px */
  --space-48: 12rem;     /* 192px */

  /* ---------------------------------------------------------------
     LAYOUT
     --------------------------------------------------------------- */
  --container-max:   1440px;
  --container-wide:  1680px;
  --container-text:  760px;
  --container-nav:   1180px;
  --measure:         68ch;
  --measure-intro:   60ch;

  --page-pad:        var(--space-5);   /* mobile default; overridden below */
  --grid-cols:       4;
  --grid-gap:        var(--space-4);
  --section-pad:     var(--space-16);

  /* ---------------------------------------------------------------
     BORDERS & RADII
     --------------------------------------------------------------- */
  --border-width:      1px;
  --border-width-ink:  1.5px;
  --border-hairline:   var(--border-width) solid var(--color-border);
  --border-strong:     var(--border-width) solid var(--color-border-strong);
  --border-ink:        var(--border-width-ink) solid var(--color-ink);
  --border-inverse:    var(--border-width) solid var(--color-border-inverse);

  --radius-xs:    4px;
  --radius-sm:    8px;
  --radius-md:    16px;
  --radius-lg:    28px;
  --radius-hero:  32px;
  --radius-pill:  999px;

  /* ---------------------------------------------------------------
     SHADOWS
     --------------------------------------------------------------- */
  /* The nav's ambient alpha is animated in JS (§6.1) and JS cannot read a
     token — so the colour is published as a bare channel triple that the
     animation interpolates an alpha into, and the dark theme's much deeper
     shadow arrives through the same var() with nothing to switch on. */
  --shadow-nav-rgb:  26 25 23;
  --shadow-nav-near: 0 2px 6px -2px rgb(26 25 23 / 0.14);
  --shadow-nav:
    var(--shadow-nav-near),
    0 12px 32px -14px rgb(var(--shadow-nav-rgb) / 0.42);
  --shadow-card: none;
  --shadow-card-hover:
    0 1px 2px rgb(26 25 23 / 0.06),
    0 16px 36px -20px rgb(26 25 23 / 0.28);
  --shadow-overlay:
    0 4px 12px -4px rgb(26 25 23 / 0.16),
    0 32px 64px -24px rgb(26 25 23 / 0.36);
  --shadow-focus:
    0 0 0 3px var(--color-bg),
    0 0 0 5px var(--color-focus);
  --shadow-focus-inverse:
    0 0 0 3px var(--color-ink),
    0 0 0 5px var(--color-focus-inverse);

  /* ---------------------------------------------------------------
     MOTION
     --------------------------------------------------------------- */
  --duration-instant:  100ms;
  --duration-fast:     160ms;
  --duration-base:     220ms;
  --duration-slow:     320ms;
  --duration-entrance: 560ms;
  --duration-hero:     700ms;

  --ease-standard: cubic-bezier(0.2, 0.6, 0.2, 1);
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:       cubic-bezier(0.7, 0, 0.84, 0);
  --ease-linear:   linear;

  /* ---------------------------------------------------------------
     Z-INDEX
     --------------------------------------------------------------- */
  --z-base:     0;
  --z-grain:    1;
  --z-sticky:   50;
  --z-nav:      100;
  --z-overlay:  150;
  --z-modal:    160;
  --z-toast:    170;
  --z-skiplink: 200;
}

/* -----------------------------------------------------------------
   RESPONSIVE TOKEN OVERRIDES
   Breakpoints are documented as custom properties for reference,
   but media queries require literal values.
   --bp-sm: 480px · --bp-md: 768px · --bp-lg: 1024px
   --bp-xl: 1280px · --bp-2xl: 1440px
   ----------------------------------------------------------------- */

@media (min-width: 480px) {
  :root { --page-pad: var(--space-6); }
}

@media (min-width: 768px) {
  :root {
    --page-pad:    var(--space-8);
    --grid-cols:   8;
    --grid-gap:    var(--space-5);
    --section-pad: var(--space-20);
  }
}

@media (min-width: 1024px) {
  :root {
    --page-pad:    var(--space-12);
    --grid-cols:   12;
    --grid-gap:    var(--space-6);
    --section-pad: var(--space-24);
  }
}

@media (min-width: 1440px) {
  :root {
    --page-pad:    var(--space-16);
    --section-pad: var(--space-32);
  }
}
```

---

## 14. Implementation guidance

Framework-agnostic where possible. Examples use React; the principles hold for any stack.

### 14.1 Token ownership

Tokens live in exactly one file: `styles/tokens.css`, imported once at the app root. It is
the only file in the codebase permitted to contain a hex value, a px spacing value, or a
duration.

```
styles/
  tokens.css      ← the only source of raw values
  reset.css
  base.css        ← element defaults, type styles, .container, .grid
  utilities.css   ← .u-visually-hidden, .u-measure, .br-lg
components/
  Button/Button.module.css   ← var() references only
```

Enforce it with a lint rule:

```js
// stylelint.config.js
rules: {
  'declaration-property-value-disallowed-list': {
    '/color|background|border-color|fill|stroke/': [/^#(?!fff|FFF)/, /^rgb\(/, /^hsl\(/],
    '/^(margin|padding|gap|top|left|right|bottom)/': [/^\d+px$/],
  },
}
```

Add an exception comment (`/* stylelint-disable-next-line */`) with a written reason when a
one-off is genuinely required. If exceptions accumulate, the token set is wrong — fix the
tokens rather than the exceptions.

**Tailwind users:** map tokens into `theme.extend` so the utility names and the CSS
variables stay in sync, and disable the default palette so no one can type `bg-blue-500`.

```js
// tailwind.config.js
theme: {
  colors: {
    bg: 'var(--color-bg)',
    surface: 'var(--color-surface)',
    ink: 'var(--color-ink)',
    action: {
      DEFAULT: 'var(--color-action)',
      hover: 'var(--color-action-hover)',
      subtle: 'var(--color-action-subtle)',
    },
    // …
  },
    spacing: { 1: 'var(--space-1)', 2: 'var(--space-2)', 4: 'var(--space-4)' /* … */ },
  borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', pill: 'var(--radius-pill)' },
}
```

### 14.2 Layout components

Build three primitives and compose everything from them. Layout components own spacing;
content components never set their own outer margins.

```jsx
// Section — owns vertical rhythm
export function Section({ tone = 'default', children, ...rest }) {
  return (
    <section
      className={`section section--${tone}`}
      style={{ paddingBlock: 'var(--section-pad)' }}
      {...rest}
    >
      {children}
    </section>
  );
}

// Container — owns horizontal bounds
export function Container({ size = 'max', children }) {
  return <div className={`container container--${size}`}>{children}</div>;
}

// Grid — owns columns
export function Grid({ children }) {
  return <div className="grid">{children}</div>;
}
```

Usage stays declarative and the spacing system is impossible to bypass:

```jsx
<Section tone="surface">
  <Container>
    <Grid>
      <div style={{ gridColumn: '1 / 8' }}>…</div>
      <div style={{ gridColumn: '9 / -1' }}>…</div>
    </Grid>
  </Container>
</Section>
```

**Margin rule:** components use `margin-block-end` only, never `margin-block-start`. This
makes collapsing predictable and lets the last child's margin be trimmed with
`> *:last-child { margin-block-end: 0 }`. Better still, prefer `gap` on a flex/grid parent
and no margins at all.

### 14.3 Responsive typography without breakpoints

Type styles are classes, never inline sizes. Every size is a `clamp()` from §13, so there
are zero typography media queries in component CSS.

```css
.text-display {
  font-family: var(--font-display);
  font-size: var(--text-display);
  font-weight: var(--weight-bold);
  line-height: var(--leading-display);
  letter-spacing: var(--tracking-display);
}
```

The only responsive typography exception is line breaking:

```css
.br-lg { display: none; }
@media (min-width: 1024px) { .br-lg { display: inline; } }
```

```jsx
<h1 className="text-display">
  We build brands<br className="br-lg" />
  that look like<br className="br-lg" />
  somewhere else.
</h1>
```

### 14.4 Grain and halftone

**Global grain — one element, GPU-composited, ~1KB.**

```css
.grain {
  position: fixed;
  inset: 0;
  z-index: var(--z-grain);
  pointer-events: none;
  opacity: 0.5;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  background-repeat: repeat;
  will-change: opacity;
}
```

Rules:
- **One instance,** mounted once at the app root. Not per-section.
- `position: fixed` so it never repaints on scroll.
- Never animate the grain. Animated film grain destroys scroll performance and triggers
  motion sensitivity.
- If it costs more than 1ms of paint on a mid-range Android, drop to a static 140×140 PNG.
- Disable it under `prefers-reduced-transparency` and inside modals.

**Halftone** belongs in the image asset, not in CSS (§8.2). If a CSS halftone is
unavoidable — for a color block, never over text — use a repeating radial gradient:

```css
.halftone {
  background-image: radial-gradient(circle at center, var(--color-ink-blue) 1.2px, transparent 1.2px);
  background-size: 6px 6px;
  transform: rotate(45deg) scale(1.5); /* the 45° screen angle */
}
```

### 14.5 Hero image optimization

The hero is the LCP element. Budget: **under 180 KB** and LCP under 2.0s on 4G.

```jsx
<picture>
  <source
    type="image/avif"
    srcSet="/hero-800.avif 800w, /hero-1200.avif 1200w, /hero-1800.avif 1800w, /hero-2400.avif 2400w"
    sizes="(min-width: 1440px) 1440px, 100vw"
  />
  <source type="image/webp" srcSet="/hero-800.webp 800w, /hero-1800.webp 1800w" sizes="…" />
  <img
    src="/hero-1200.jpg"
    alt="A lone figure walking toward an oversized coral sun above a flat blue horizon"
    width="2400"
    height="1350"
    fetchPriority="high"
    decoding="async"
  />
</picture>
```

- **Never lazy-load the hero.** `loading="lazy"` on an LCP image is a guaranteed regression.
  Add `fetchpriority="high"` and preload it in `<head>`.
- Everything below the fold gets `loading="lazy"` and `decoding="async"`.
- AVIF first — halftone patterns compress far better in AVIF than JPEG, often 40–50%
  smaller at the same quality.
- Serve separate art-directed crops per breakpoint (§7.4 and §11.2), not one crop that gets
  `object-fit`.

### 14.6 Preventing layout shift

Target **CLS < 0.05.**

1. **Always set `width` and `height`** on `<img>`, even when CSS overrides the size. This
   gives the browser the aspect ratio before the bytes arrive.
2. **Reserve space with `aspect-ratio`** on the container:
   ```css
   .hero__media { aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--radius-hero); }
   .hero__media img { width: 100%; height: 100%; object-fit: cover; }
   ```
3. **Placeholder is a flat ink color**, not a shimmer — set `background-color` to the
   image's dominant color exported in §8.2. It matches the print aesthetic and costs nothing.
4. **Fonts:** `size-adjust` fallbacks (§3.1) plus `font-display: swap` keeps the swap from
   reflowing the hero headline.
5. **Sticky nav:** it is `position: sticky` inside normal flow, so it never shifts content.
   Do not switch it to `fixed` on scroll.
6. **Reveal animations** use `transform` and `opacity` only — neither affects layout.
7. Reserve space for anything async: embeds, banners, cookie notices.

### 14.7 Keeping accessibility during implementation

- Build the component keyboard-first: tab to it, operate it, tab away, before styling.
- The focus ring is written into the base component styles, not bolted on at the end.
- Automated checks in CI (`axe-core` via Playwright) catch roughly 40% of issues. The other
  60% needs a manual pass: keyboard-only navigation, screen reader smoke test on the hero
  and the contact form, 200% zoom, reduced motion forced on.
- Contrast is asserted in tests, not eyeballed:
  ```js
  expect(contrastRatio(tokens['--color-text-muted'], tokens['--color-bg'])).toBeGreaterThan(4.5);
  ```

### 14.8 Component reusability

- **Props describe intent, not appearance.** `<Button variant="primary">`, not
  `<Button blue pill>`. When the primary color changes, one token changes.
- **No layout props on leaf components.** A `Button` never takes `marginTop`. The parent
  owns the space between things.
- **Variants are a closed set.** Use a `cva`-style map or a union type so a variant that
  does not exist is a build error.
- **Compose, don't configure.** A `Card` with eleven boolean props should be three
  components: `Card`, `ProjectCard`, `ServiceCard`.
- **State classes over inline styles.** `data-state="loading"` styled in CSS beats a style
  object rebuilt on every render.
- **Every component ships its own states.** A component is not done until hover, active,
  focus-visible, disabled, and loading are all implemented and in the story/fixture.

---

## 15. Do and don't

### Do

| Do | Because |
|---|---|
| Use one dominant artwork per section | The image is the argument; two images argue with each other. |
| Keep supporting UI neutral | Restraint is what makes the artwork read as expensive. |
| Let typography create hierarchy | Size and weight are free; boxes and colors cost contrast budget. |
| Use vivid color intentionally and rarely | One blue button on a page is a button. Four are wallpaper. |
| Preserve generous whitespace | Below `--space-32` between desktop sections, the page stops feeling premium. |
| Keep pill shapes and hairline borders consistent | A single radius family is what reads as a system. |
| Bake halftone into image assets | Baked texture reads as print; CSS-filtered texture reads as a filter. |
| Break display headlines manually | Uneven, deliberate line lengths are the editorial signature. |
| Set every state before shipping a component | Half the interface's quality lives in hover and focus. |
| Test with keyboard and reduced motion before review | Retrofitting accessibility costs more than building it. |

### Don't

| Don't | Because |
|---|---|
| Turn every component into a colorful card | Card-plus-color on everything flattens hierarchy to zero. |
| Add glassmorphism, blur, or frosted panels | It fights the flat printed-ink direction completely. |
| Stack shadows on cards, sections, and buttons | Only the nav and overlays float. Everything else uses a border. |
| Overuse gradients | The palette is ink on paper. Gradients belong inside artwork as halftone steps. |
| Make every heading oversized | If everything is display size, nothing is. One display per page. |
| Copy the reference site literally | Extract principles. A pixel copy is a legal risk and a creative failure. |
| Sacrifice accessibility for aesthetics | Amber text on off-white is 1.7:1. It looks great and nobody can read it. |
| Animate text letter-by-letter | It delays reading and dates the site instantly. |
| Use icon sets in service cards | Generic icon libraries are the fastest way to look templated. |
| Center body copy | Left-aligned ragged-right is the editorial default. Centering breaks the grid. |
| Hide content on mobile | If it does not matter small, it does not matter large. |
| Add a testimonial carousel | Nobody reads slide two. Pick the best one. |
| Introduce a value outside the token scale | 30px is not a design decision, it is a rounding error. |

---

## Appendix A — Quick reference

```
Canvas          #FBFAF6      Paper white
Ink             #1A1917      Warm charcoal
Action          #1B3FA0      Deep ultramarine
Artwork inks    #F4573D coral · #FFB227 amber · #00A05A green · #1B3FA0 blue

Display         Space Grotesk 700 · 52–136px · 0.92 · −0.04em
Body            IBM Plex Sans 400 · 17px · 1.65
Meta            Space Mono 400 · 12px · 0.14em · uppercase

Grid            12 col / 24px gutter · max 1440 · pad 64
Rhythm          Section 128 desktop · 64 mobile
Radius          8 input · 16 card · 28 image · 32 hero · 999 pill
Motion          160 hover · 220 transform · 560 entrance
Focus           3px gap + 2px #1B3FA0
```

## Appendix B — Pre-launch checklist

- [ ] All text meets 4.5:1; large display meets 3:1
- [ ] Full site navigable by keyboard; focus always visible
- [ ] Skip link present and functional; `scroll-margin-top` on anchor targets
- [ ] Mobile menu traps focus, closes on `Escape`, restores focus
- [ ] `prefers-reduced-motion` honored; nothing stuck at `opacity: 0`
- [ ] Hero LCP < 2.0s on 4G; hero not lazy-loaded; `fetchpriority="high"` set
- [ ] CLS < 0.05; all images have `width`/`height`
- [ ] No horizontal scroll at 320px; layout holds at 200% zoom
- [ ] One `<h1>`; heading order unbroken
- [ ] Every form field has a visible label; errors carry icon + text + `role="alert"`
- [ ] No hex values or raw px outside `tokens.css`
- [ ] Exactly one display-size headline and one primary CTA per page
- [ ] Every image has meaningful `alt` or `alt=""`
- [ ] No essential text baked into any image