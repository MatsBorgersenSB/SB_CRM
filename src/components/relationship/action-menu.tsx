"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type MenuPosition = {
  top: number;
  left: number;
};

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
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = menu?.offsetWidth || 180;
      const menuHeight = menu?.offsetHeight || 0;
      const gap = 4;
      const pad = 8;

      let top = rect.bottom + gap;
      if (menuHeight > 0 && top + menuHeight > window.innerHeight - pad) {
        top = Math.max(pad, rect.top - gap - menuHeight);
      }

      let left = align === "right" ? rect.right - menuWidth : rect.left;
      left = Math.min(Math.max(pad, left), window.innerWidth - menuWidth - pad);

      setPosition({ top, left });
    };

    updatePosition();
    // Re-measure after paint once menu dimensions are known
    const frame = window.requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align, children]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={triggerRef}
      className={`relative block w-full min-w-0 max-w-full ${className}`}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="block w-full min-w-0 max-w-full truncate text-left text-inherit underline-offset-2 transition-colors hover:text-upcycle-orange hover:underline"
      >
        {label}
      </button>
      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[80] min-w-[180px] border border-carbon-blue/15 bg-white py-1 shadow-sm"
              style={{ top: position.top, left: position.left }}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
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
        role="menuitem"
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} role="menuitem">
      {children}
    </button>
  );
}
