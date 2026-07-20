import type { ReactNode } from "react";
import {
  EDITORIAL_DIVIDER,
  EDITORIAL_LABEL,
  EDITORIAL_PANEL,
} from "@/lib/editorial-design-system";

export function EditorialSectionLabel({ children }: { children: ReactNode }) {
  return <p className={EDITORIAL_LABEL}>{children}</p>;
}

export function EditorialSection({
  title,
  emptyLabel,
  children,
  hasItems,
}: {
  title: string;
  emptyLabel: string;
  children: ReactNode;
  hasItems: boolean;
}) {
  return (
    <section className={`${EDITORIAL_DIVIDER} pt-8`}>
      <EditorialSectionLabel>{title}</EditorialSectionLabel>
      {hasItems ? (
        <div className="mt-4">{children}</div>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-carbon-blue/45">{emptyLabel}</p>
      )}
    </section>
  );
}

export function EditorialPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${EDITORIAL_PANEL} ${className}`}>{children}</div>;
}
