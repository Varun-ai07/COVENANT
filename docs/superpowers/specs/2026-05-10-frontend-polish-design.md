# Frontend Polish Design Spec — Phase 3

> **Status:** Ready for Implementation
> **Created:** 2026-05-10
> **Approach:** Hybrid — Iterative Refine then Reassess

---

## Overview

This spec covers the systematic audit and enhancement of the COVENANT frontend, following the warm stone design system established in `DESIGN.md`. The approach is three-phase:

1. **Audit & Fix** — Resolve inconsistencies, fix critical bugs (RainbowKit), fill component gaps
2. **Visual Enhancement** — Use TasteSkill for imagery, refine animations, polish interactions
3. **Reassess** — Evaluate if comprehensive redesign still needed

---

## Phase 1: Component Audit & Fixes

### 1.1 Critical Bug: RainbowKit Wallet Connection

**Problem:** MetaMask popup doesn't appear when clicking Connect button.

**Root Causes:**
1. Grain overlay `z-index: 9999` blocks clicks on RainbowKit modal
2. Missing `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (using fallback `"demo"`)
3. Modal overlay z-index conflicts

**Files to Modify:**
- `frontend/src/app/globals.css`
- `frontend/.env.local`

**Fix:**

```css
/* globals.css — Grain overlay z-index fix */
.grain-overlay::before {
  z-index: 1;  /* Changed from 9999 */
}

/* Modal overlay must be above grain */
[data-rk] [data-testid="rk-modal-overlay"] {
  z-index: 9999 !important;
}
```

**User Action Required:**
1. Go to https://cloud.walletconnect.com
2. Create project → copy Project ID
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<get-from-walletconnect-cloud>
   ```

### 1.2 Component Inconsistencies to Fix

| Component | File | Issue | Fix |
|-----------|------|-------|-----|
| Card | `ui/Card.tsx` | Border uses hardcoded `rgba` | Change to `border-border` token |
| Button | `ui/Button.tsx` | Primary hover contrast issue | Use `bg-accent-hover` |
| Sidebar | `layout/Sidebar.tsx` | Uses `text-gray-*` classes | Replace with `text-muted` |
| TopBar | `layout/TopBar.tsx` | Missing `font-accent` on labels | Add typography consistency |
| globals.css | — | Grain z-index conflict | Reduce to `z-index: 1` |

### 1.3 Missing Components to Build

| Component | Purpose | Priority | Dependencies |
|-----------|---------|----------|--------------|
| `Modal.tsx` | Dialog overlays, confirmations | High | Framer Motion |
| `Toast.tsx` | Action feedback notifications | High | None |
| `Input.tsx` | Form inputs with validation | High | None |
| `Tabs.tsx` | Tab navigation | Medium | None |
| `Select.tsx` | Dropdown selection | Medium | None |
| `Skeleton.tsx` | Unified loading placeholders | Medium | None |

### 1.4 Component Specifications

#### Modal.tsx

```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

// Usage
<Modal open={isOpen} onClose={close} title="Confirm Action">
  <p>Are you sure?</p>
  <Button variant="primary" onClick={confirm}>Confirm</Button>
</Modal>
```

**Styles:**
- Backdrop: `bg-foreground/20 backdrop-blur-sm`
- Panel: `bg-surface rounded-xl border border-border p-6 max-w-md w-full`
- Animation: `fade-in + scale(0.95 → 1)` 200ms
- Close: backdrop click, ESC key, X button

#### Input.tsx

```tsx
interface InputProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

// Usage
<Input label="Agent Name" error="Required" placeholder="Enter name..." />
```

**Styles:**
- Container: `flex flex-col gap-1.5`
- Label: `font-accent text-xs text-muted uppercase tracking-wide`
- Input: `bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:border-border-hover focus:outline-none`
- Error: `border-danger text-danger` + error message below
- Focus ring: `ring-2 ring-accent/20` (optional)

#### Toast.tsx

```tsx
// API via toast() function
toast.success("Task created successfully");
toast.error("Transaction failed");
toast.info("Processing...");

// Or component-based
<Toast message="Success" type="success" onClose={() => {}} />
```

**Styles:**
- Position: `fixed bottom-4 right-4 z-50`
- Container: `bg-surface border border-border rounded-lg px-4 py-3 shadow-sm`
- Success: `border-success/30 text-success`
- Error: `border-danger/30 text-danger`
- Info: `border-info/30 text-info`
- Animation: `slide-up + fade-in` 200ms, auto-dismiss after 4s

---

## Phase 2: Visual Enhancement

### 2.1 TasteSkill Integration

Use TasteSkill to generate:

| Image | Location | Purpose |
|-------|----------|---------|
| Hero background | Homepage hero section | Subtle abstract/tech pattern |
| Feature illustrations | Feature cards (3-4) | Visual representation of protocol |
| Dashboard header | `/dashboard` | Agent network visualization |
| Empty states | Throughout app | Friendly placeholders |

**Prompt Guidelines:**
- Style: Minimal, geometric, warm stone palette (#D8C9AE base)
- Avoid: Neon, gradients, glassmorphism, purple
- Format: SVG preferred, PNG fallback

### 2.2 Animation Refinements

Based on DESIGN.md motion rules:

| Animation | Current | Refined |
|-----------|---------|---------|
| Card hover | `scale: 1.005` | Keep — subtle is correct |
| Stagger delay | `0.08s` | Keep for lists |
| Hero entrance | `duration: 0.9` | Keep |
| Page transitions | `opacity + y: 8` | Keep |

**Additions:**
- Button press: `active:scale-[0.98]` for tactile feedback
- Toast entrance: `slide-up` from bottom-right
- Modal entrance: `scale(0.95) → 1` with fade

### 2.3 Typography Polish

| Element | Current | Fix |
|---------|---------|-----|
| Section numbers | `font-accent` | Correct, keep |
| Stats values | `font-heading` | Correct, keep |
| Code/addresses | `font-mono` | Correct, keep |
| Body | `font-body` | Correct, keep |

**Focus areas:**
- Ensure consistent `letter-spacing` on labels
- Verify `line-height` matches DESIGN.md specs
- Check `font-weight` consistency across variants

---

## Phase 3: Reassess

After Phase 1 and 2 are complete:

1. **Visual audit** — Compare against DESIGN.md anti-patterns
2. **User test** — Verify wallet connection works
3. **Component coverage** — Ensure all common patterns have components
4. **Decide** — Is comprehensive redesign still needed?

If yes, create new spec focusing on:
- New color palette (if warm stone isn't sufficient)
- Redesigned homepage hero
- Enhanced dashboard layouts

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| `frontend/src/app/globals.css` | Grain z-index fix, modal z-index ensure |
| `frontend/.env.local` | Add WalletConnect Project ID |
| `frontend/src/components/ui/Card.tsx` | Border token fix |
| `frontend/src/components/ui/Button.tsx` | Hover state fix |
| `frontend/src/components/layout/Sidebar.tsx` | Token consistency |
| `frontend/src/components/layout/TopBar.tsx` | Typography consistency |
| `frontend/src/components/ui/Modal.tsx` | **NEW** — Modal component |
| `frontend/src/components/ui/Input.tsx` | **NEW** — Input component |
| `frontend/src/components/ui/Toast.tsx` | **NEW** — Toast component |
| `frontend/src/components/ui/Tabs.tsx` | **NEW** — Tabs component |
| `frontend/src/components/ui/Select.tsx` | **NEW** — Select component |
| `frontend/src/components/ui/Skeleton.tsx` | **NEW** — Skeleton component |

---

## Verification Checklist

Before proceeding to implementation:

- [ ] WalletConnect Project ID obtained
- [ ] MetaMask installed in browser
- [ ] `npm run dev` works without errors
- [ ] DESIGN.md reviewed for anti-patterns

After Phase 1 implementation:

- [ ] Connect button opens wallet modal
- [ ] MetaMask popup appears
- [ ] Connection succeeds
- [ ] All existing pages render without visual regressions
- [ ] New components render correctly

After Phase 2 implementation:

- [ ] Hero images generated and integrated
- [ ] Animations feel smooth but not distracting
- [ ] Typography is consistent across all pages

---

## Dependencies

- `framer-motion` — Already installed
- `lucide-react` — Already installed
- `@rainbow-me/rainbowkit` — Already installed
- `wagmi` — Already installed

No new dependencies required.
