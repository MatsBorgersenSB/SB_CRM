"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function ActionMenu({
  label,
  children,
  className = "",
  align = "left",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={ref} className={`relative block w-full min-w-0 max-w-full ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="block w-full min-w-0 max-w-full truncate text-left text-inherit underline-offset-2 transition-colors hover:text-upcycle-orange hover:underline"
      >
        {label}
      </button>
      {open ? (
        <div
          className={`absolute top-full z-30 mt-1 min-w-[180px] border border-carbon-blue/15 bg-white py-1 shadow-sm ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ActionMenuItem({
  href,
  onClick,
  children,
  external,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  external?: boolean;
}) {
  const className =
    "block w-full px-3 py-1.5 text-left text-[11px] text-carbon-blue/75 hover:bg-carbon-blue/[0.04] hover:text-upcycle-orange";

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
