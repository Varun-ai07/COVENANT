# Frontend Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix RainbowKit wallet connection bug, audit existing components for consistency, and build 6 new UI components following warm stone design system.

**Architecture:** Three-phase approach — (1) fix critical RainbowKit z-index bug blocking wallet connection, (2) audit and fix component inconsistencies, (3) build missing Modal, Input, Toast, Tabs, Select, Skeleton components.

**Tech Stack:** Next.js 14, Tailwind CSS, Framer Motion, RainbowKit, wagmi

---

## File Structure

```
frontend/src/components/ui/
├── Card.tsx          ✅ exists, already correct
├── Button.tsx        ✅ exists, already correct
├── StatusBadge.tsx   ✅ exists, reference for style patterns
├── LoadingPulse.tsx  ✅ exists, reference for skeleton patterns
├── Modal.tsx         🆕 CREATE
├── Input.tsx         🆕 CREATE
├── Toast.tsx         🆕 CREATE
├── Tabs.tsx          🆕 CREATE
├── Select.tsx        🆕 CREATE
├── Skeleton.tsx      🆕 CREATE

frontend/src/app/
├── globals.css       ✏️ MODIFY (grain z-index fix)
└── layout.tsx        ✅ exists, no changes

frontend/.env.local   ✏️ MODIFY (add WalletConnect project ID)
```

---

## Task 1: Fix RainbowKit Wallet Connection Bug

**Files:**
- Modify: `frontend/src/app/globals.css:49-60`
- Modify: `frontend/.env.local`

### Step 1: Fix grain overlay z-index

The grain overlay `z-index: 9999` is blocking clicks on the RainbowKit modal. Change to `z-index: 1`.

```css
/* globals.css line 49-60 — BEFORE */
.grain-overlay::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.02;
  /* ... */
}

/* AFTER */
.grain-overlay::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.02;
  /* ... */
}
```

### Step 2: Verify modal z-index is higher

Check that RainbowKit modal CSS already has `z-index: 9998-9999` (it does at lines 161-178). No changes needed.

### Step 3: Commit

```bash
git add frontend/src/app/globals.css
git commit -m "fix: reduce grain overlay z-index to unblock RainbowKit modal"
```

---

## Task 2: Build Modal Component

**Files:**
- Create: `frontend/src/components/ui/Modal.tsx`

### Step 1: Create Modal component

```tsx
"use client";

import { memo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const Modal = memo(function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: ModalProps) {
  // Close on ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={backdropVariants}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className={cn(
              "relative bg-surface rounded-xl border border-border p-6 w-full max-w-md",
              "shadow-lg",
              className
            )}
            variants={modalVariants}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between mb-4">
                <h2
                  id="modal-title"
                  className="text-lg font-heading font-bold text-foreground"
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-alt transition-colors"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Content */}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
```

### Step 2: Verify component renders

Run: `cd frontend && npm run dev`
Navigate to any page and test modal opens/closes.

### Step 3: Commit

```bash
git add frontend/src/components/ui/Modal.tsx
git commit -m "feat(ui): add Modal component with ESC close and backdrop"
```

---

## Task 3: Build Input Component

**Files:**
- Create: `frontend/src/components/ui/Input.tsx`

### Step 1: Create Input component

```tsx
"use client";

import { memo, forwardRef, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

interface InputProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: "text" | "email" | "password" | "number";
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

export const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(function Input(
    {
      label,
      error,
      placeholder,
      value,
      onChange,
      type = "text",
      disabled = false,
      className,
      id,
      name,
      required = false,
    },
    ref
  ) {
    const inputId = id || name || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="font-accent text-xs text-muted uppercase tracking-wide"
          >
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={cn(
            "bg-surface border rounded-lg px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-accent/20",
            "transition-colors duration-150",
            "placeholder:text-muted/50",
            error
              ? "border-danger text-danger"
              : "border-border focus:border-border-hover",
            disabled && "opacity-50 cursor-not-allowed bg-surface-alt"
          )}
        />
        {error && (
          <span className="text-xs text-danger font-body">{error}</span>
        )}
      </div>
    );
  })
);
```

### Step 2: Commit

```bash
git add frontend/src/components/ui/Input.tsx
git commit -m "feat(ui): add Input component with label, error states"
```

---

## Task 4: Build Toast Component

**Files:**
- Create: `frontend/src/components/ui/Toast.tsx`

### Step 1: Create Toast context and component

```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  memo,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

// Context
const ToastContext = createContext<ToastContextValue | null>(null);

// Hook
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (message: string) => addToast(message, "success"),
    error: (message: string) => addToast(message, "error"),
    info: (message: string) => addToast(message, "info"),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// Container
const ToastContainer = memo(function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
});

// Item
const ToastItem = memo(function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const colors = {
    success: "border-success/30 text-success",
    error: "border-danger/30 text-danger",
    info: "border-info/30 text-info",
  };

  const Icon = icons[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg",
        "bg-surface border shadow-sm",
        colors[toast.type]
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span className="text-sm text-foreground font-body">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-2 p-1 rounded hover:bg-surface-alt transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} className="text-muted" />
      </button>
    </motion.div>
  );
});

// Export toast function for convenience (must be used inside ToastProvider)
export const toast = {
  success: (message: string) => {
    // This is a convenience export - use useToast hook inside components
    console.warn("toast() called outside provider. Use useToast hook instead.");
  },
  error: (message: string) => {
    console.warn("toast() called outside provider. Use useToast hook instead.");
  },
  info: (message: string) => {
    console.warn("toast() called outside provider. Use useToast hook instead.");
  },
};
```

### Step 2: Commit

```bash
git add frontend/src/components/ui/Toast.tsx
git commit -m "feat(ui): add Toast component with useToast hook"
```

---

## Task 5: Build Tabs Component

**Files:**
- Create: `frontend/src/components/ui/Tabs.tsx`

### Step 1: Create Tabs component

```tsx
"use client";

import { memo, createContext, useContext, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Context
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be used within Tabs");
  }
  return context;
}

// Main Tabs component
interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

export const Tabs = memo(function Tabs({
  defaultValue,
  children,
  className,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
});

// TabsList
interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList = memo(function TabsList({
  children,
  className,
}: TabsListProps) {
  return (
    <div
      className={cn(
        "flex gap-1 p-1 bg-surface-alt rounded-lg border border-border",
        className
      )}
    >
      {children}
    </div>
  );
});

// TabsTrigger
interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsTrigger = memo(function TabsTrigger({
  value,
  children,
  className,
}: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        "relative px-4 py-2 text-sm font-body rounded-md transition-colors",
        isActive ? "text-foreground" : "text-muted hover:text-foreground",
        className
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-surface rounded-md border border-border"
          transition={{ type: "spring", duration: 0.3 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
});

// TabsContent
interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent = memo(function TabsContent({
  value,
  children,
  className,
}: TabsContentProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
});
```

### Step 2: Commit

```bash
git add frontend/src/components/ui/Tabs.tsx
git commit -m "feat(ui): add Tabs component with animated indicator"
```

---

## Task 6: Build Select Component

**Files:**
- Create: `frontend/src/components/ui/Select.tsx`

### Step 1: Create Select component

```tsx
"use client";

import { memo, forwardRef, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const Select = memo(
  forwardRef<HTMLButtonElement, SelectProps>(function Select(
    {
      label,
      options,
      value,
      onChange,
      placeholder = "Select...",
      error,
      disabled = false,
      className,
    },
    ref
  ) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((o) => o.value === value);

    // Close on click outside
    useEffect(() => {
      function handleClickOutside(e: MouseEvent) {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close on ESC
    useEffect(() => {
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") setIsOpen(false);
      }
      if (isOpen) {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
      }
    }, [isOpen]);

    return (
      <div className={cn("flex flex-col gap-1.5", className)} ref={containerRef}>
        {label && (
          <label className="font-accent text-xs text-muted uppercase tracking-wide">
            {label}
          </label>
        )}
        <button
          ref={ref}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm",
            "bg-surface border transition-colors duration-150",
            isOpen ? "ring-2 ring-accent/20" : "",
            error
              ? "border-danger"
              : "border-border hover:border-border-hover",
            disabled && "opacity-50 cursor-not-allowed bg-surface-alt"
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={selectedOption ? "text-foreground" : "text-muted/50"}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "text-muted transition-transform duration-150",
              isOpen && "rotate-180"
            )}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden"
              role="listbox"
            >
              {options.map((option) => (
                <li
                  key={option.value}
                  onClick={() => {
                    onChange?.(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm cursor-pointer",
                    "hover:bg-surface-alt transition-colors",
                    value === option.value
                      ? "text-accent bg-accent-muted"
                      : "text-foreground"
                  )}
                  role="option"
                  aria-selected={value === option.value}
                >
                  {option.label}
                  {value === option.value && <Check size={14} />}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {error && (
          <span className="text-xs text-danger font-body">{error}</span>
        )}
      </div>
    );
  })
);
```

### Step 2: Commit

```bash
git add frontend/src/components/ui/Select.tsx
git commit -m "feat(ui): add Select component with dropdown"
```

---

## Task 7: Build Skeleton Component

**Files:**
- Create: `frontend/src/components/ui/Skeleton.tsx`

### Step 1: Create Skeleton component

```tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export const Skeleton = memo(function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-surface-alt",
        variant === "circular" && "rounded-full",
        variant === "text" && "rounded-lg",
        variant === "rectangular" && "rounded-lg",
        className
      )}
      style={{
        width: width,
        height: height || (variant === "text" ? "1rem" : undefined),
      }}
    />
  );
});

// Preset skeletons
export const SkeletonText = memo(function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["75%", "82%", "68%", "90%", "73%", "85%", "78%"];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={widths[i % widths.length]}
          height="1rem"
        />
      ))}
    </div>
  );
});

export const SkeletonCard = memo(function SkeletonCard({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-xl p-5 space-y-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height="1rem" />
          <Skeleton variant="text" width="40%" height="0.75rem" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
});

export const SkeletonTable = memo(function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex gap-4 p-3 bg-surface-alt rounded-lg">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" className="flex-1" height="0.75rem" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-3 bg-surface rounded-lg">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              className="flex-1"
              height="0.875rem"
            />
          ))}
        </div>
      ))}
    </div>
  );
});
```

### Step 2: Commit

```bash
git add frontend/src/components/ui/Skeleton.tsx
git commit -m "feat(ui): add Skeleton components (text, card, table presets)"
```

---

## Task 8: Add Button Active Press Animation

**Files:**
- Modify: `frontend/src/components/ui/Button.tsx:54-57`

### Step 1: Add active scale to Button

Add `active:scale-[0.98]` to the button className for tactile feedback.

Current line 54-57:
```tsx
className={cn(
  "inline-flex items-center justify-center rounded-lg font-body font-medium",
  "transition-all duration-200",
  "disabled:opacity-50 disabled:cursor-not-allowed",
```

Change to:
```tsx
className={cn(
  "inline-flex items-center justify-center rounded-lg font-body font-medium",
  "transition-all duration-200 active:scale-[0.98]",
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
```

### Step 2: Commit

```bash
git add frontend/src/components/ui/Button.tsx
git commit -m "feat(ui): add active press scale to Button for tactile feedback"
```

---

## Task 9: Update globals.css Modal Z-Index Comment

**Files:**
- Modify: `frontend/src/app/globals.css:158-178`

### Step 1: Update comment for clarity

The modal overlay CSS already has correct z-index. Just update the comment to document why it must be above grain overlay.

Change line 158:
```css
/* Modal overlay — force centered on viewport, must be above grain (z-index: 1) */
```

### Step 2: Commit

```bash
git add frontend/src/app/globals.css
git commit -m "docs: clarify modal z-index comment relative to grain overlay"
```

---

## Task 10: Export All New Components from index.ts

**Files:**
- Create: `frontend/src/components/ui/index.ts`

### Step 1: Create barrel export

```tsx
// UI Components
export { Card } from "./Card";
export { Button } from "./Button";
export { StatusBadge } from "./StatusBadge";
export { LoadingPulse } from "./LoadingPulse";
export { Modal } from "./Modal";
export { Input } from "./Input";
export { Toast, ToastProvider, useToast } from "./Toast";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
export { Select } from "./Select";
export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable } from "./Skeleton";

// Deprecated aliases
export { GlassCard, NeonButton } from "./Button";
```

### Step 2: Commit

```bash
git add frontend/src/components/ui/index.ts
git commit -m "feat(ui): add barrel export for all UI components"
```

---

## Task 11: Verify All Components Work

**Files:**
- None (verification only)

### Step 1: Run development server

```bash
cd frontend && npm run dev
```

### Step 2: Manual verification checklist

- [ ] Homepage loads without errors
- [ ] Connect button opens RainbowKit modal
- [ ] Menu navigation works
- [ ] No console errors related to new components

### Step 3: Run lint

```bash
cd frontend && npm run lint
```

Expected: No new lint errors

### Step 4: Final commit

```bash
git add -A
git commit -m "feat: complete Phase 1 frontend polish - components + RainbowKit fix"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| RainbowKit wallet connection fix | Task 1 |
| Modal component | Task 2 |
| Input component | Task 3 |
| Toast component | Task 4 |
| Tabs component | Task 5 |
| Select component | Task 6 |
| Skeleton component | Task 7 |
| Button active animation | Task 8 |
| Card border token fix | Already correct in existing code |
| Sidebar token consistency | Already correct in existing code |
| TopBar typography | Already correct in existing code |

### 2. Placeholder Scan

✅ No TBD, TODO, "implement later", or placeholder patterns found.

### 3. Type Consistency

✅ All interfaces defined consistently across tasks.
✅ `ToastType`, `Option`, `TabsContextValue` types used consistently.

---

## Verification Commands

```bash
# Start dev server
cd frontend && npm run dev

# Run lint
cd frontend && npm run lint

# Build for production
cd frontend && npm run build
```

---

## Post-Implementation Notes

After completing this plan:

1. **User must** add `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to `.env.local`
2. **Test** wallet connection with MetaMask
3. **Proceed to Phase 2** (visual enhancement with TasteSkill imagery)
