"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type AsyncSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isSubmitting?: boolean;
  idleLabel: ReactNode;
  submittingLabel?: ReactNode;
};

/**
 * Submit button that disables and shows a spinner while a form request is in flight.
 */
export function AsyncSubmitButton({
  isSubmitting = false,
  idleLabel,
  submittingLabel = "Saving…",
  disabled,
  className = "",
  type = "button",
  ...rest
}: AsyncSubmitButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isSubmitting}
      aria-busy={isSubmitting}
      className={`inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {isSubmitting ? (
        <>
          <span
            className="inline-block h-3 w-3 animate-spin border border-current border-t-transparent"
            aria-hidden
          />
          <span>{submittingLabel}</span>
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}
