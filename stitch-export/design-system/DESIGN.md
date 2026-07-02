---
name: StarBuddy Core
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#c1c6d6'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#8b909f'
  outline-variant: '#414754'
  surface-tint: '#acc7ff'
  primary: '#acc7ff'
  on-primary: '#002f68'
  primary-container: '#498fff'
  on-primary-container: '#00285b'
  inverse-primary: '#005bbf'
  secondary: '#f1c04c'
  on-secondary: '#3f2e00'
  secondary-container: '#b58a17'
  on-secondary-container: '#372700'
  tertiary: '#7bdb80'
  on-tertiary: '#00390e'
  tertiary-container: '#44a34f'
  on-tertiary-container: '#00320b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-mono:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-max: 1200px
  gutter: 16px
---

## Brand & Style
The brand personality is **Developer-First & Trustworthy**. It operates as a high-utility utility, mimicking the reliability of foundational developer tools like GitHub and Vercel. The UI evokes a sense of fairness and transparency through a structured, systematic aesthetic.

The design style is **Corporate / Modern** with a focus on high-density information and technical precision. It utilizes a "Low-Contrast Outline" approach combined with subtle tonal layering to create a familiar environment for engineers and open-source maintainers. The emotional response should be one of professional competence and collaborative efficiency.

## Colors
The palette is rooted in a "Deep Charcoal" dark mode to reduce eye strain during long-term use.

- **Primary (GitHub Blue):** Used for primary actions, links, and "Active" status indicators.
- **Secondary (Star Yellow):** Reserved exclusively for star-related interactions, credit earning, and "Promoted" highlights.
- **Tertiary (Success Green):** Used for "Eligible" status and credit accumulation.
- **Neutral / Background:** A multi-layered gray scale ranging from deep black `#010409` for the canvas to slate grays for borders and secondary text.

## Typography
The system uses **Inter** for all functional UI and body text, ensuring maximum readability and a neutral, professional tone. To reinforce the developer-centric nature of the platform, **Geist** (monospace) is used for repository names, credit counts, and technical identifiers.

Large headlines scale down by 20% on mobile devices. Labels use uppercase styling and increased tracking for section headers and status badges.

## Layout & Spacing
This design system uses a **Fluid Grid** model with a 4px baseline rhythm.

- **Desktop:** 12-column grid with 24px margins and 16px gutters.
- **Tablet:** 8-column grid with 16px margins.
- **Mobile:** 4-column grid with 12px margins.

Spacing is applied strictly in multiples of 4. Use `16px (md)` for standard component internal padding and `24px (lg)` for section gaps.

## Elevation & Depth
Depth is created through **Tonal Layers** and **Subtle Outlines** rather than heavy shadows.

- **Level 0 (Canvas):** The base background layer (`#010409`).
- **Level 1 (Card/Surface):** A slightly lighter gray (`#161B22`) with a 1px border (`#30363D`).
- **Level 2 (Dropdowns/Modals):** A darker surface with a very subtle 8px ambient shadow (Black, 40% opacity) and a brighter border to define edges against the background.

Status indicators use a 2px inner-glow or high-contrast solid fills to stand out without requiring elevation.

## Shapes
The design system adopts a **Soft (1)** roundedness level.

- **Standard Buttons & Inputs:** 6px (0.375rem) corner radius.
- **Cards & Large Containers:** 8px (0.5rem) corner radius.
- **Badges/Chips:** 100px (Pill) for status indicators to contrast against the more geometric UI.

## Components

### Buttons & Inputs
- **Primary Action:** Solid "GitHub Blue" background with white text.
- **Secondary Action:** Transparent background with a `border_muted` stroke.
- **Input Fields:** Darker than the card background, using a subtle 1px border that glows "GitHub Blue" on focus.

### Status Indicators (Badges)
- **Active:** Pill-shaped, Primary Blue text on a 10% opacity blue background.
- **Paused:** Gray text and border.
- **Eligible:** Success Green text with a small leading dot.

### Specific Concept Components
- **Credit Counter:** Monospace text paired with a small Star Yellow icon. Use a "Credit Loop" animation (subtle rotating border) when credits are being processed or earned in real-time.
- **Promotion Slots:** Card-based layout with a "Status Toggle" in the top right. Inactive slots should appear at 50% opacity with a dashed border.
- **Task Cards:** High-density rows. The "Claim" button should be the primary visual anchor. Repository names must always be rendered in `label-mono`.
- **The Credit Loop:** A visual progress ring or horizontal bar that fills as users complete star tasks, visually connecting "Tasks" to "Earnings."
