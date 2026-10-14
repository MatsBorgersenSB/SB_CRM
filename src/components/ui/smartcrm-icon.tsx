"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Bookmark,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Coins,
  Dices,
  FileText,
  FolderClosed,
  FolderKanban,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  TrendingUp,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  readSectionCollapsed,
  writeSectionCollapsed,
} from "@/lib/workspace-collapsible-state";
import type { AttentionObjectType, AttentionSeverity } from "@/types/attention-item";
import type { SearchEntityType } from "@/types/universal-search";
import {
  HUB_SECTION_ICONS,
  healthStatusScanIcon,
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

/** Pixel size per icon slot. Matches the sidebar's line-icon scale. */
const SIZE_PX = { xs: 12, sm: 14, md: 16, lg: 20 } as const;

type IconSize = keyof typeof SIZE_PX;

/**
 * One icon system. Every object, action and state icon in SmartCRM resolves
 * to a Lucide line icon — the same family the sidebar uses — so icons share
 * stroke, colour tokens and dark-mode behaviour. No emoji in product UI.
 */
const LUCIDE_BY_NAME: Record<SmartCRMIconName, LucideIcon> = {
  contact: User,
  people: Users,
  company: Building2,
  opportunity: TrendingUp,
  document: FileText,
  documentSet: FolderClosed,
  email: Mail,
  phone: Phone,
  location: MapPin,
  website: Globe,
  meeting: CalendarDays,
  needsAttention: TriangleAlert,
  urgent: CircleAlert,
  waiting: Clock,
  healthy: CircleCheck,
  completed: Check,
  value: Coins,
  stage: TrendingUp,
  probability: Dices,
  opNumber: Bookmark,
  edit: Pencil,
  search: Search,
  activity: CalendarDays,
  add: Plus,
  project: FolderKanban,
};

const OBJECT_TYPE_ICON: Record<AttentionObjectType, SmartCRMIconName> = {
  Company: "company",
  Contact: "contact",
  Opportunity: "opportunity",
  Activity: "meeting",
  Document: "document",
  DocumentSet: "documentSet",
  TransmissionPackage: "documentSet",
  CommercialBaseline: "document",
  Tender: "search",
};

const SEARCH_ENTITY_ICON: Record<SearchEntityType, SmartCRMIconName> = {
  company: "company",
  contact: "contact",
  deal: "opportunity",
  activity: "meeting",
  document: "document",
  document_set: "documentSet",
  transmission: "documentSet",
  attention: "needsAttention",
  note: "edit",
  raw_material: "documentSet",
};

/**
 * Severity icon + colour are decided together so the symbol can never
 * contradict its word (no green tick beside "Needs attention").
 */
const SEVERITY_ICON: Record<AttentionSeverity, { name: SmartCRMIconName; className: string; label: string }> = {
  urgent: { name: "urgent", className: "text-red-600", label: "Urgent" },
  needs_attention: { name: "needsAttention", className: "text-amber-600", label: "Needs attention" },
  waiting: { name: "waiting", className: "text-carbon-blue/65", label: "Waiting" },
  healthy: { name: "healthy", className: "text-emerald-600", label: "Healthy" },
  completed: { name: "completed", className: "text-carbon-blue/65", label: "Completed" },
};

export function SmartCRMIcon({
  name,
  size = "sm",
  className = "",
  label,
}: {
  name: SmartCRMIconName;
  size?: IconSize;
  className?: string;
  /** Accessible label when icon carries meaning alone */
  label?: string;
}) {
  const Icon = LUCIDE_BY_NAME[name];
  return (
    <Icon
      size={SIZE_PX[size]}
      strokeWidth={1.75}
      className={`inline-block shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function SeverityIcon({
  severity,
  size = "sm",
  className = "",
}: {
  severity: AttentionSeverity;
  size?: IconSize;
  className?: string;
}) {
  const meta = SEVERITY_ICON[severity];
  return (
    <SmartCRMIcon
      name={meta.name}
      size={size}
      className={`${meta.className} ${className}`}
      label={meta.label}
    />
  );
}

export function ObjectTypeIcon({
  objectType,
  size = "xs",
  className = "",
}: {
  objectType: AttentionObjectType;
  size?: IconSize;
  className?: string;
}) {
  return <SmartCRMIcon name={OBJECT_TYPE_ICON[objectType]} size={size} className={className} />;
}

export function SearchEntityIcon({
  entityType,
  size = "sm",
  className = "",
}: {
  entityType: SearchEntityType;
  size?: IconSize;
  className?: string;
}) {
  return <SmartCRMIcon name={SEARCH_ENTITY_ICON[entityType]} size={size} className={className} />;
}

const HEALTH_SEVERITY: Record<ReturnType<typeof healthStatusScanIcon>, AttentionSeverity> = {
  healthy: "healthy",
  needsAttention: "needs_attention",
  urgent: "urgent",
};

export function HealthStatusIcon({
  status,
  size = "sm",
  className = "",
}: {
  status: string;
  size?: IconSize;
  className?: string;
}) {
  return (
    <SeverityIcon
      severity={HEALTH_SEVERITY[healthStatusScanIcon(status)]}
      size={size}
      className={className}
    />
  );
}

/** Icon before scannable label text — e.g. [mail] Email */
export function IconLabel({
  icon,
  children,
  className = "",
  iconSize = "sm",
}: {
  icon: SmartCRMIconName;
  children: ReactNode;
  className?: string;
  iconSize?: IconSize;
}) {
  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`}>
      <SmartCRMIcon name={icon} size={iconSize} className="text-current opacity-60" />
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
      <SmartCRMIcon name={icon} size="sm" className="opacity-60" />
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
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/60">
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
        expanded ? (
          <ChevronDown size={12} strokeWidth={2} className="shrink-0 text-carbon-blue/65" aria-hidden />
        ) : (
          <ChevronRight size={12} strokeWidth={2} className="shrink-0 text-carbon-blue/65" aria-hidden />
        )
      ) : null}
      {sectionIcon ? <SmartCRMIcon name={sectionIcon} size="sm" className="text-carbon-blue/55" /> : null}
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
