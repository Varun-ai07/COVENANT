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
