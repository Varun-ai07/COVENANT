# COVENANT Design System

> Generated from three elite design skills: **TasteSkill**, **Emil Kowalski**, and **Impeccable**.
> This document defines the visual identity, anti-patterns, and component standards for COVENANT's frontend.

---

## Design Register

COVENANT operates in **Product Mode** — design serves the protocol, not the brand.

- **Users**: Blockchain developers, AI researchers, protocol operators reading fast, often in the dark
- **Brand voice**: Authoritative, technical, calm confidence — "what TCP/IP was to computers, COVENANT is to AI agents"
- **Anti-references**: Purple gradients. Glassmorphism. Neon glow effects. Inter font. Italic-serif hero displays. Pill-button eyebrow chips. Side-stripe accent cards. Cardocalypse (cards nested in cards).

---

## 1. Colors

### Primary Palette — Warm Stone

COVENANT uses an organic, warm neutral palette that signals trust and substance over flash.

| Token | Hex | OKLCH | Usage |
|-------|-----|-------|-------|
| `background` | `#D8C9AE` | `oklch(82% 0.02 80)` | Page background |
| `surface` | `#f0e8d8` | `oklch(92% 0.01 80)` | Card/surface fill |
| `surface-alt` | `#e5dcc9` | `oklch(88% 0.02 80)` | Nested surfaces, code blocks |
| `foreground` | `#1a1917` | `oklch(12% 0.01 80)` | Primary text |
| `muted` | `#7a7168` | `oklch(50% 0.02 80)` | Secondary text, labels |
| `border` | `rgba(26,25,23,0.1)` | — | Default borders |
| `border-hover` | `rgba(26,25,23,0.2)` | — | Interactive hover borders |

### Semantic Accents

| Token | Hex | OKLCH | Usage |
|-------|-----|-------|-------|
| `accent` | `#575757` | `oklch(42% 0.00 0)` | Primary actions, icons, links |
| `accent-hover` | `#3d3d3d` | `oklch(30% 0.00 0)` | Hover states on accent |
| `accent-muted` | `rgba(87,87,87,0.1)` | — | Subtle accent backgrounds |
| `charcoal` | `#575757` | `oklch(42% 0.00 0)` | Terminal chrome, decorative |
| `success` | `#16a34a` | `oklch(62% 0.18 145)` | Completed, verified |
| `warning` | `#d97706` | `oklch(70% 0.15 70)` | Staked ETH, pending |
| `danger` | `#dc2626` | `oklch(58% 0.20 25)` | Errors, failed, overdue |
| `info` | `#0891b2` | `oklch(58% 0.12 210)` | Worker addresses, IDs |

### Selection Color

```css
::selection {
  background: rgba(87, 87, 87, 0.2);
  color: #1a1917;
}
```

### RainbowKit Token Overrides

All RainbowKit CSS variables are remapped in `globals.css` to the warm stone palette. The connect button uses `surface` background with `border` edges — never a different color from the rest of the UI.

---

## 2. Typography

### Font Stack

| Role | Font | Weight | CSS Variable |
|------|------|--------|-------------|
| **Heading** | Orbitron | 400, 700 | `--font-heading` |
| **Body** | Space Grotesk Variable | 400–700 | `--font-body` |
| **Accent/Labels** | Space Mono | 400 | `--font-accent` |
| **Code** | Space Mono + Fira Code | 400 | `--font-mono` |

### Type Scale (Fixed — Product Mode)

| Name | Size | Usage |
|------|------|-------|
| Hero | `text-7xl` / `text-8xl` / `text-[10rem]` / `text-[12rem]` | Homepage COVENANT title only |
| Display | `text-4xl` / `text-5xl` / `text-6xl` | Section headings |
| Title | `text-2xl` / `text-3xl` | Card titles, page subtitles |
| Body | `text-base` / `text-lg` | Paragraph text |
| Small | `text-sm` / `text-xs` | Labels, metadata |
| Micro | `text-[10px]` | Agent card stats, capability tags |

### Typography Rules

- **Antialiasing**: `-webkit-font-smoothing: antialiased` on `body` (already applied)
- **Line height**: Use `leading-[0.85]` for hero text, `leading-relaxed` for body, `leading-tight` for headings
- **Letter spacing**: `tracking-tight` on large headings, `tracking-wide` on accent labels, `tracking-widest` on section numbers
- **Font weight**: Orbitron uses 400 for display, 700 for emphasis. Space Grotesk uses 500 for buttons, 400 for body.
- **Mono usage**: All on-chain data (addresses, tx hashes, task IDs, ETH amounts) uses `font-mono`
- **Never**: Inter, Fraunces, Geist, Mona Sans, Plus Jakarta Sans, Recoleta, Instrument Sans

---

## 3. Spacing & Layout

### Spacing System

COVENANT uses a consistent 4px base grid.

| Token | Value | Usage |
|-------|-------|-------|
| `px-4` | 16px | Page horizontal gutter |
| `px-6` | 24px | Card inner padding (sm) |
| `py-3` | 12px | Button vertical padding (sm) |
| `p-5` | 20px | Card inner padding (md) |
| `p-8` | 32px | Card inner padding (lg) |
| `gap-4` | 16px | Grid/flex gap (default) |
| `gap-5` | 20px | Card grid gap |
| `gap-6` | 24px | Section-level spacing |
| `mb-8` | 32px | Section margin-bottom |
| `py-24` | 96px | Section vertical padding (base) |
| `py-36` | 144px | Section vertical padding (desktop) |

### Layout Constants

| Property | Value | Notes |
|----------|-------|-------|
| Max content width | `max-w-7xl` (80rem) | Dashboard, marketplace |
| Reading width | `max-w-4xl` (56rem) | Prose sections |
| Tight reading | `max-w-3xl` (48rem) | Paragraph text |
| Card border-radius | `rounded-xl` (12px) | All cards, buttons |
| Section dividers | `<hr className="border-border" />` | Between homepage sections |

### Overflow Control

```css
body { overflow-x: hidden; }
/* Grain overlay: position: fixed; inset: 0; pointer-events: none; z-index: 9999; */
```

---

## 4. Elevation

COVENANT uses **flat elevation** — no box-shadows, no drop-shadows, no glassmorphism.

### Layering Strategy

| Layer | z-index | Element |
|-------|---------|---------|
| 0 | default | Page content |
| 1 | `relative z-10` | Content over decorative backgrounds |
| 9999 | `z-[9999]` | Grain overlay (fixed, pointer-events: none) |

### Surface Hierarchy

```
background (#D8C9AE)     ← page bg
  └─ surface (#f0e8d8)   ← card bg
       └─ surface-alt (#e5dcc9) ← nested/selected states
```

### Border as Elevation

Instead of shadows, use border opacity to signal depth:
- Default: `border-border` (10% opacity)
- Hover: `border-border-hover` (20% opacity)
- Active/selected: explicit semantic color at 30% opacity (`border-accent/30`)

---

## 5. Components

### Card

```tsx
// Three variants, three padding levels
<Card variant="default" padding="md">    // bg-surface, border
<Card variant="elevated" padding="lg">   // bg-surface-alt, border
<Card variant="interactive" padding="sm"> // hover:border-border-hover, hover:bg-surface-alt, cursor-pointer
```

**Rules:**
- Always `rounded-xl` (12px)
- Never nest cards inside cards (anti-pattern: Cardocalypse)
- Never use thick left-border accent strips (anti-pattern)
- Interactive cards use `transition-all duration-200`

### Button

```tsx
<Button variant="primary" size="lg">   // bg-accent, text-background
<Button variant="secondary" size="md"> // bg-surface, border
<Button variant="ghost" size="sm">     // transparent, hover:bg-surface
<Button variant="danger">              // bg-danger/10, text-danger
```

**Rules:**
- Always `rounded-lg` (8px)
- Font: `font-body font-medium`
- Transition: `transition-all duration-200`
- Loading state: `<Loader2 className="animate-spin" />`
- Disabled: `opacity-50 cursor-not-allowed`

### StatusBadge

```tsx
<StatusBadge status={TaskStatus.Completed} size="sm" />
<StatusBadge status="failed" size="md" />
```

**Pattern:**
- `inline-flex items-center gap-1.5 border rounded-full font-mono`
- Icon (12px or 14px) + label
- Semantic color: `text-{color} bg-{color}/10 border-{color}/30`

### AgentCard

- Hover: `whileHover={{ scale: 1.005 }}` (subtle, not bouncy)
- Stats row: 3-column grid (Reputation / Tasks / Success%)
- Capability tags: `px-2 py-0.5 text-[10px] font-mono rounded-md bg-surface-alt border border-border text-muted`
- Rank badge: `px-2 py-0.5 text-[10px] font-mono rounded-full bg-warning/10 border border-warning/30 text-warning`

### StatCard (Dashboard)

- Border glow on hover: `border-{color}/30 hover:border-{color}/60`
- Loading skeleton: `h-8 w-16 rounded-lg bg-surface-alt animate-pulse`
- Value: `text-3xl font-heading font-bold`
- Label: `text-muted font-mono text-xs`

### LoadingPulse

- `animate-pulse` with staggered width percentages: `[75, 82, 68, 90, 73]`
- Each line: `h-4 rounded-lg bg-surface-alt`

---

## 6. Motion & Animation

### Philosophy (Emil Kowalski)

> "You don't need animations. Why you are animating more often than you should."

- **Purpose**: Every animation must serve a function — reveal content, confirm action, guide attention
- **Restraint**: If an animation doesn't improve comprehension, remove it
- **Timing**: 200ms for micro-interactions, 300-500ms for reveals, 600-800ms for hero transitions
- **Easing**: `ease-out` for entrances, `ease-in-out` for loops

### Allowed Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| `fade-in` | 200ms | ease-out | Toast notifications, quick reveals |
| `fade-in-up` | 300ms | ease-out | Content entering viewport |
| `slide-up` | 200ms | ease-out | Dropdown menus, modals |
| `shimmer` | 1.5s | ease-in-out infinite | Loading skeletons |
| `pulse-sand` | 2s | ease-in-out infinite | Attention pulse on elements |
| `grain` | 0.5s | steps(1) infinite | Grain texture overlay |
| `animate-pulse` | Tailwind default | — | Loading states |
| `animate-spin` | Tailwind default | — | Loader icon |

### Framer Motion Patterns

```tsx
// Staggered container
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

// Item entrance
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// Scroll-triggered reveal (once)
<motion.div
  initial={{ opacity: 0, y: 32 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: index * 0.12 }}
  viewport={{ once: true }}
>
```

### Motion Rules

- **Hover scale**: `whileHover={{ scale: 1.005 }}` — barely perceptible, never bouncy
- **Viewport triggers**: Always `viewport={{ once: true }}` — no re-animation on scroll back
- **Stagger delay**: `0.08s` for lists, `0.1s` for cards, `0.12s` for feature grids
- **Hero entrance**: `duration: 0.9` with `delay: 0.25` increments for sequential elements
- **No**: Parallax, scroll-jacking, infinite bouncing, rotation animations, `prefers-reduced-motion` violations

---

## 7. Responsive Strategy

### Breakpoints

| Breakpoint | Prefix | Layout Changes |
|-----------|--------|---------------|
| Base (<640px) | — | Single column, `text-7xl` hero |
| `sm:` (640px) | `sm:` | `text-8xl` hero, 2-col stats grid |
| `md:` (768px) | `md:` | `text-[10rem]` hero, 2-col features, terminal blocks |
| `lg:` (1024px) | `lg:` | `text-[12rem]` hero, 4-col features, side nav |

### Responsive Rules

- Hero sections: scale from `text-7xl` to `text-[12rem]` across breakpoints
- Stat grids: `grid-cols-2 md:grid-cols-4`
- Feature cards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Terminal blocks: `grid-cols-1 md:grid-cols-2`
- CTA buttons: `flex-col sm:flex-row`

---

## 8. Effects & Textures

### Grain Overlay (Already Implemented)

```css
.grain-overlay::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.02;
  background-image: url("data:image/svg+xml,...");
  background-size: 256px;
  animation: grain 0.5s steps(1) infinite;
}
```

- **Opacity**: 0.02 — barely visible, adds texture without distraction
- **Fixed position**: Covers entire viewport regardless of scroll
- **Never increase opacity** above 0.04 — grain is a whisper, not a shout

### Radial Glows

Used sparingly on hero sections only:

```tsx
<div
  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
  style={{ background: "radial-gradient(ellipse, rgba(87,87,87,0.06) 0%, transparent 70%)" }}
/>
```

- Max opacity: 6%
- Single color: accent (#575757) or charcoal
- Never: multi-color gradients, animated glows, colored light effects

---

## 9. Anti-Patterns (Impeccable Detection)

### Absolute Prohibitions

| Anti-Pattern | Why | Detection |
|-------------|-----|-----------|
| **Purple gradients** | AI-default slop; COVENANT uses warm stone | Any `#8b5cf6`, `#7c3aed`, gradient with purple |
| **Glassmorphism** | `backdrop-filter: blur()` on cards | `backdrop-blur` on non-modal elements |
| **Neon glow effects** | `box-shadow` with colored glow | `box-shadow` with colored spread |
| **Inter font** | Default AI typeface | `font-family: Inter` |
| **Thick border accent cards** | Side-stripe pattern | `border-l-4` or `border-l-[3px]` |
| **Cardocalypse** | Cards nested in cards | `<Card>` inside `<Card>` |
| **Italic-serif hero** | AI-generated marketing fingerprint | `<em>` or `italic` at hero scale |
| **Pill-button eyebrows** | Uppercase label above h1 | `text-xs uppercase tracking-widest` directly above `<h1>` |
| **Gradient text headings** | `background-clip: text` on headings | Any `bg-clip-text text-transparent` |
| **Bad contrast** | Muted text on muted background | Text below 4.5:1 contrast ratio |
| **Bouncy hover** | `whileHover={{ scale: 1.05 }}` or higher | Scale > 1.01 on hover |
| **Infinite bounce/rotate** | Decorative animations with no purpose | `infinite` on non-shimmer/non-grain |

### Allowed Exceptions

- RainbowKit modal: may use `backdrop-filter: blur(8px)` (already implemented)
- Grain overlay: fixed texture at 0.02 opacity is the one allowed global effect
- StatusBadge: semantic color borders at `/30` opacity are functional, not decorative

---

## 10. Do's and Don'ts

### Do

- Use `font-mono` for all on-chain data (addresses, hashes, amounts, task IDs)
- Use `font-heading` (Orbitron) for page titles and stat numbers
- Use `font-body` (Space Grotesk) for all prose and button text
- Use `font-accent` (Space Mono) for section numbers, labels, navigation
- Use `rounded-xl` (12px) for cards, `rounded-lg` (8px) for buttons and inputs
- Use `border-border` for structure, `border-{color}/30` for semantic emphasis
- Use `text-muted` for secondary information, `text-foreground/60` for tertiary
- Use `transition-all duration-200` on interactive elements
- Use `motion.div` with `viewport={{ once: true }}` for scroll reveals
- Use staggered entrance (`staggerChildren: 0.08`) for lists and grids
- Use semantic colors consistently: success=green, warning=amber, danger=red, info=cyan

### Don't

- Don't use box-shadows for elevation — use border opacity instead
- Don't use backdrop-blur on cards or surfaces
- Don't animate hover scales above 1.01
- Don't re-animate elements when scrolling back up
- Don't nest cards inside cards
- Don't use gradient backgrounds on text
- Don't add decorative animations without functional purpose
- Don't use Inter, Fraunces, Geist, or other AI-default fonts
- Don't use pill-shaped eyebrow labels above headings
- Don't create purple or blue gradient color schemes
- Don't use `prefers-reduced-motion` — instead, just don't animate excessively
- Don't add parallax or scroll-jacking effects

---

## 11. Brand Rules

### The COVENANT Identity

COVENANT is **warm, technical, authoritative**. It is not flashy, trendy, or playful.

- **Visual tone**: Like a well-designed financial terminal or a luxury watch manual — precise, understated, confident
- **Color psychology**: Warm stone = trust, stability, organic (not sterile white, not harsh dark)
- **Typography psychology**: Orbitron = technical authority, Space Grotesk = modern clarity, Space Mono = data precision
- **Motion psychology**: Smooth, controlled, purposeful — like machinery, not confetti

### The Three Skills' Unified Principles

**From TasteSkill:**
- "Stops AI from generating boring, generic slop" — every visual choice must be intentional
- Layered backgrounds with noise texture (already implemented via grain overlay)
- Selection color branding (already implemented)
- Overflow-x-clip at multiple levels

**From Emil Kowalski:**
- "You don't need animations" — animate less, not more
- Tight content columns for readability (692px for prose)
- Subtle hover states — the `0.005` scale factor philosophy
- Component-driven thinking — every UI element is a focused primitive

**From Impeccable:**
- 27 deterministic anti-pattern rules — scan before shipping
- Brand vs Product mode — COVENANT is Product mode always
- Design system alignment is non-optional — no one-off implementations
- Polish is a superset of normalize — alignment, IA flow, cosmetic-vs-functional triage

---

## 12. Component Inventory

| Component | File | Variants |
|-----------|------|----------|
| Card | `components/ui/Card.tsx` | default, elevated, interactive |
| Button | `components/ui/Button.tsx` | primary, secondary, ghost, danger |
| StatusBadge | `components/ui/StatusBadge.tsx` | 7 task statuses + open/in_progress/completed/failed/disputed/cancelled |
| LoadingPulse | `components/ui/LoadingPulse.tsx` | configurable line count |
| ErrorBoundary | `components/ui/ErrorBoundary.tsx` | fallback UI with reload |
| AgentCard | `components/cards/AgentCard.tsx` | agent profile with stats |
| TaskCard | `components/cards/TaskCard.tsx` | task summary with status |
| GlassCard | `components/ui/GlassCard.tsx` | **@deprecated** → Card |
| NeonButton | `components/ui/NeonButton.tsx` | **@deprecated** → Button |

### Design Tokens (Tailwind Config)

```ts
// tailwind.config.ts — theme.extend
colors: {
  background: "#D8C9AE",
  surface: "#f0e8d8",
  "surface-alt": "#e5dcc9",
  foreground: "#1a1917",
  muted: "#7a7168",
  border: "rgba(26, 25, 23, 0.1)",
  "border-hover": "rgba(26, 25, 23, 0.2)",
  accent: "#575757",
  "accent-hover": "#3d3d3d",
  "accent-muted": "rgba(87, 87, 87, 0.1)",
  charcoal: "#575757",
  "charcoal-light": "#6b6b6b",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  info: "#0891b2",
}
fontFamily: {
  heading: ["Orbitron", "system-ui", "sans-serif"],
  accent: ["Space Mono", "monospace"],
  body: ["Space Grotesk Variable", "system-ui", "sans-serif"],
  mono: ["Space Mono", "Fira Code", "monospace"],
}
```

---

## 13. Audit Checklist (Pre-Ship)

Before merging any UI change, verify:

- [ ] No purple gradients or AI-default color schemes
- [ ] No glassmorphism (`backdrop-blur`) outside of modal overlays
- [ ] No box-shadow elevation — borders only
- [ ] No Inter, Fraunces, Geist, or other banned fonts
- [ ] No thick left-border accent cards
- [ ] No cards nested inside cards
- [ ] No gradient text headings
- [ ] No hover scale above 1.01
- [ ] No re-animating on scroll back (`viewport={{ once: true }}`)
- [ ] All on-chain data uses `font-mono`
- [ ] All interactive elements have `transition-all duration-200`
- [ ] All cards use `rounded-xl` (12px)
- [ ] All buttons use `rounded-lg` (8px)
- [ ] Status badges use semantic colors at `/10` bg and `/30` border
- [ ] Loading states use `animate-pulse` with staggered widths
- [ ] Grain overlay remains at 0.02 opacity
- [ ] Selection color is `rgba(87,87,87,0.2)` with `#1a1917` text

---

## 14. Skill Commands Reference

### TasteSkill (`/taste-skill`)
- Default premium all-rounder — use for any new page or component
- Sub-skills: `/soft-skill` (calm, expensive), `/minimalist-skill` (editorial), `/brutalist-skill` (Swiss typography)
- `/image-to-skill` — reference-driven implementation from screenshots
- `/redesign-skill` — audit and redesign existing pages

### Emil Kowalski (`/emil-design-eng`)
- Use for animation review and restraint enforcement
- Best for: component interaction patterns, toast/drawer patterns, motion timing
- Core principle: "if it doesn't improve comprehension, remove it"

### Impeccable (`/impeccable`)
- `/impeccable shape` — structured design discovery
- `/impeccable craft` — full implementation from brief to shipped code
- `/impeccable polish` — design system alignment pass
- `/impeccable audit` — multi-dimensional scoring with P0-P3 severity
- `/impeccable critique` — persona-based heuristic review
- `/impeccable detect` — 27 deterministic anti-pattern scan (`npx impeccable detect src/`)
- `/impeccable typeset` — typography refinement
- `/impeccable colorize` — color system refinement
- `/impeccable animate` — motion design refinement
- `/impeccable bolder` — increase visual weight
- `/impeccable quieter` — reduce visual noise
- `/impeccable harden` — production readiness (empty states, first-run)
- `/impeccable live` — browser-based iterative refinement with HMR

---

*This document is the single source of truth for COVENANT's visual identity. Every UI decision should reference these rules. When in doubt, run `/impeccable detect src/` to scan for violations.*
