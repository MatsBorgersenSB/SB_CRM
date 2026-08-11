"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const MENU_MIN_WIDTH = 180;
const MENU_Z = 80;

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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = Math.max(MENU_MIN_WIDTH, menuRef.current?.offsetWidth ?? MENU_MIN_WIDTH);
      const left =
        align === "right"
          ? Math.max(8, rect.right - menuWidth)
          : Math.min(rect.left, window.innerWidth - menuWidth - 8);
      const top = Math.min(rect.bottom + 4, window.innerHeight - 8);
      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setCoords(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setCoords(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const placeMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left =
      align === "right"
        ? Math.max(8, rect.right - MENU_MIN_WIDTH)
        : Math.min(rect.left, window.innerWidth - MENU_MIN_WIDTH - 8);
    setCoords({
      top: Math.min(rect.bottom + 4, window.innerHeight - 8),
      left,
    });
  };

  return (
    <div ref={rootRef} className={`relative block w-full min-w-0 max-w-full ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => {
            const next = !value;
            if (next) placeMenu();
            else setCoords(null);
            return next;
          });
        }}
        className="block w-full min-w-0 max-w-full truncate text-left text-inherit underline-offset-2 transition-colors hover:text-upcycle-orange hover:underline"
      >
        {label}
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="min-w-[180px] border border-carbon-blue/15 bg-white py-1 shadow-lg"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                zIndex: MENU_Z,
              }}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                setCoords(null);
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
    <button type="button" role="menuitem" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
