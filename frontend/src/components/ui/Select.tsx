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
      <div className={cn("flex flex-col gap-1.5 relative", className)} ref={containerRef}>
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
              className="absolute z-50 top-full mt-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden"
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
