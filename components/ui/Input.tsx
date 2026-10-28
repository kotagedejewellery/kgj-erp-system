// components/ui/Input.tsx

"use client";

import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, fullWidth = true, className = "", ...props },
    ref,
  ) => {
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <div className={`${widthClass} ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-[#e8e2d4] mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
            className={`
              px-3 py-2 border rounded-lg text-cream bg-cocoa
              scheme-dark appearance-none
              focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent
              disabled:bg-mocha disabled:cursor-not-allowed
              ${error ? "border-rose-300" : "border-gold/15"}
              ${widthClass}
            `}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-xs text-white/40">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
