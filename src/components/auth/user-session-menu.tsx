"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";
import { EnterpriseRoleBadge } from "@/components/auth/enterprise-role-badge";
import { USER_ROLE_LABELS, isUserRole, type UserRole } from "@/types/auth";
import { startAzureAdSignIn } from "@/lib/auth-client";

/**
 * Header auth control — NextAuth session only (no mock Access Tier).
 */
export function UserSessionMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") {
    return (
      <div className="h-8 w-36 animate-pulse border border-carbon-blue/10 bg-carbon-blue/[0.04]" />
    );
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <button
        type="button"
        disabled={signingIn}
        onClick={() => {
          setSigningIn(true);
          startAzureAdSignIn("/");
        }}
        className="inline-flex items-center gap-1.5 border border-upcycle-orange bg-upcycle-orange px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90 disabled:opacity-60"
      >
        {signingIn ? "Redirecting…" : "🔑 Sign In with Microsoft 365"}
      </button>
    );
  }

  const name = session.user.name?.trim() || session.user.email?.trim() || "Microsoft 365 user";
  const email = session.user.email?.trim() || "—";
  const image = session.user.image ?? null;
  const tenant = session.azureTenantId || "—";
  const role: UserRole =
    session.user.role && isUserRole(session.user.role)
      ? session.user.role
      : "commercial";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex max-w-[240px] items-center gap-2 border border-carbon-blue/12 bg-white px-2 py-1 text-left transition-colors hover:border-upcycle-orange/30"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="size-6 shrink-0 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="inline-flex size-6 shrink-0 items-center justify-center bg-carbon-blue text-[9px] font-semibold text-white">
            {initials || "SB"}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-carbon-blue">
            {name}
          </span>
          <span className="block truncate text-[9px] text-carbon-blue/45">{email}</span>
        </span>
        <EnterpriseRoleBadge accessRole={role} compact tone="light" />
        <ChevronDown className="size-3.5 shrink-0 text-carbon-blue/40" strokeWidth={2} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-[80] mt-1 w-72 border border-carbon-blue/15 bg-white py-2 shadow-sm"
        >
          <div className="border-b border-carbon-blue/10 px-3 pb-2">
            <p className="truncate text-[13px] font-semibold text-carbon-blue">{name}</p>
            <p className="mt-0.5 truncate text-[11px] text-carbon-blue/55">{email}</p>
          </div>
          <dl className="space-y-1.5 px-3 py-2 text-[11px]">
            <div className="flex justify-between gap-3">
              <dt className="text-carbon-blue/40">Email</dt>
              <dd className="truncate font-medium text-carbon-blue">{email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-carbon-blue/40">Role</dt>
              <dd className="font-medium text-carbon-blue">{USER_ROLE_LABELS[role]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-carbon-blue/40">Azure Tenant</dt>
              <dd className="truncate font-medium text-carbon-blue" title={tenant}>
                {tenant}
              </dd>
            </div>
          </dl>
          <div className="border-t border-carbon-blue/10 px-2 pt-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut({ callbackUrl: "/auth/signin" })}
              className="inline-flex w-full items-center gap-2 px-2 py-2 text-left text-[12px] font-semibold text-thermal-red transition-colors hover:bg-thermal-red/5"
            >
              <LogOut className="size-3.5" strokeWidth={2} />
              Log Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
