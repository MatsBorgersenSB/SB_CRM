"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  readSectionCollapsed,
  writeSectionCollapsed,
} from "@/lib/workspace-collapsible-state";
import type { AttentionObjectType, AttentionSeverity } from "@/types/attention-item";
import type { SearchEntityType } from "@/types/universal-search";
import {
  ATTENTION_SEVERITY_ICONS,
  HUB_SECTION_ICONS,
  SMARTCRM_ICONS,
  attentionObjectEmoji,
  healthStatusEmoji,
  searchEntityEmoji,
  type SmartCRMIconName,
} from "@/lib/smartcrm-visual-language";
import {
  WORKSPACE_PANEL_BODY_CLASS,
  WORKSPACE_PANEL_COLLAPSE_COLLAPSED,
  WORKSPACE_PANEL_COLLAPSE_EXPANDED,
  WORKSPACE_PANEL_COLLAPSE_INNER,
  WORKSPACE_PANEL_COLLAPSE_WRAPPER,
  WORKSPACE_PANEL_HEADER_CLASS,
  WORKSPACE_PANEL_HEADER_WRAPPER,
} from "@/lib/workspace-design-system";

const SIZE_CLASS = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

export function SmartCRMIcon({
  name,
  size = "sm",
  className = "",
  label,
}: {
  name: SmartCRMIconName;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  /** Accessible label when icon carries meaning alone */
  label?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 leading-none ${SIZE_CLASS[size]} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {SMARTCRM_ICONS[name]}
    </span>
  );
}

export function SeverityIcon({
  severity,
  size = "sm",
  className = "",
}: {
  severity: AttentionSeverity;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 leading-none ${SIZE_CLASS[size]} ${className}`}
      aria-label={severity.replace("_", " ")}
      role="img"
    >
      {ATTENTION_SEVERITY_ICONS[severity]}
    </span>
  );
}

export function ObjectTypeIcon({
  objectType,
  size = "xs",
  className = "",
}: {
  objectType: AttentionObjectType;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 leading-none ${SIZE_CLASS[size]} ${className}`}
      aria-hidden
    >
      {attentionObjectEmoji(objectType)}
    </span>
  );
}

export function SearchEntityIcon({
  entityType,
  size = "sm",
  className = "",
}: {
  entityType: SearchEntityType;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span className={`inline-block shrink-0 leading-none ${SIZE_CLASS[size]} ${className}`} aria-hidden>
      {searchEntityEmoji(entityType)}
    </span>
  );
}

export function HealthStatusIcon({
  status,
  size = "sm",
  className = "",
}: {
  status: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 leading-none ${SIZE_CLASS[size]} ${className}`}
      aria-label={`Health: ${status}`}
      role="img"
    >
      {healthStatusEmoji(status)}
    </span>
  );
}

/** Icon before scannable label text — e.g. 📧 Email */
export function IconLabel({
  icon,
  children,
  className = "",
  iconSize = "sm",
}: {
  icon: SmartCRMIconName;
  children: ReactNode;
  className?: string;
  iconSize?: keyof typeof SIZE_CLASS;
}) {
  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`}>
      <SmartCRMIcon name={icon} size={iconSize} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** Actionable field row — icon + value, scan-friendly */
export function ActionableField({
  icon,
  children,
  className = "",
}: {
  icon: SmartCRMIconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-[13px] text-carbon-blue/70 ${className}`}
    >
      <SmartCRMIcon name={icon} size="sm" />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

export function WorkspaceHubSection({
  title,
  children,
  id,
  icon,
}: {
  title: string;
  children: ReactNode;
  id?: string;
  icon?: SmartCRMIconName;
}) {
  const sectionIcon = icon ?? HUB_SECTION_ICONS[title];

  return (
    <section id={id} className="border-t border-carbon-blue/10 px-6 py-5">
      <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
        {sectionIcon ? <SmartCRMIcon name={sectionIcon} size="xs" /> : null}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Standalone panel for display-aware grid workspaces */
export function WorkspacePanel({
  title,
  children,
  id,
  icon,
  className = "",
  collapsible = false,
  defaultCollapsed = false,
  count,
  collapseStorageKey,
  headerTrailing,
}: {
  title: string;
  children: ReactNode;
  id?: string;
  icon?: SmartCRMIconName;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  count?: number;
  collapseStorageKey?: string;
  /** Optional action on the right of the section label (e.g. View all →). */
  headerTrailing?: ReactNode;
}) {
  const sectionIcon = icon ?? HUB_SECTION_ICONS[title];
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [hydrated, setHydrated] = useState(!collapsible);

  useEffect(() => {
    if (!collapsible || !collapseStorageKey) {
      setHydrated(true);
      return;
    }
    setCollapsed(readSectionCollapsed(collapseStorageKey, defaultCollapsed));
    setHydrated(true);
  }, [collapsible, collapseStorageKey, defaultCollapsed]);

  useEffect(() => {
    if (!collapsible || !id) return;

    const expandForHash = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== `#${id}`) return;
      setCollapsed(false);
      if (collapseStorageKey) writeSectionCollapsed(collapseStorageKey, false);
    };

    expandForHash();
    window.addEventListener("hashchange", expandForHash);
    return () => window.removeEventListener("hashchange", expandForHash);
  }, [collapsible, id, collapseStorageKey]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (collapseStorageKey) writeSectionCollapsed(collapseStorageKey, next);
      return next;
    });
  }, [collapseStorageKey]);

  const expanded = !collapsed;
  const titleLabel = count !== undefined ? `${title} (${count})` : title;

  const headerContent = (
    <>
      {collapsible ? (
        <span className="w-3 shrink-0 text-[10px] leading-none text-carbon-blue/45" aria-hidden>
          {expanded ? "▼" : "▶"}
        </span>
      ) : null}
      {sectionIcon ? <SmartCRMIcon name={sectionIcon} size="sm" /> : null}
      <span>{titleLabel}</span>
    </>
  );

  const collapseClass =
    collapsible && hydrated
      ? expanded
        ? WORKSPACE_PANEL_COLLAPSE_EXPANDED
        : WORKSPACE_PANEL_COLLAPSE_COLLAPSED
      : WORKSPACE_PANEL_COLLAPSE_EXPANDED;

  return (
    <section
      id={id}
      className={`dashboard-card flex min-h-0 flex-col overflow-hidden ${className}`}
    >
      <header className={WORKSPACE_PANEL_HEADER_WRAPPER}>
        {collapsible ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggle}
              className={`${WORKSPACE_PANEL_HEADER_CLASS} min-w-0 flex-1 cursor-pointer text-left transition-colors hover:text-carbon-blue`}
              aria-expanded={expanded}
            >
              {headerContent}
            </button>
            {headerTrailing}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <h2 className={`${WORKSPACE_PANEL_HEADER_CLASS} min-w-0`}>{headerContent}</h2>
            {headerTrailing}
          </div>
        )}
      </header>
      <div className={`${WORKSPACE_PANEL_COLLAPSE_WRAPPER} ${collapseClass}`}>
        <div className={WORKSPACE_PANEL_COLLAPSE_INNER}>
          <div className={WORKSPACE_PANEL_BODY_CLASS}>{children}</div>
        </div>
      </div>
    </section>
  );
}
