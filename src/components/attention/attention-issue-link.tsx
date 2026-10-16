"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  attentionIssueHref,
  isExternalAttentionHref,
  type AttentionItem,
} from "@/types/attention-item";

/**
 * Opens the listed Attention issue — mail, activity, company, or deal.
 */
export function AttentionIssueLink({
  item,
  children,
  className,
}: {
  item: Pick<AttentionItem, "href" | "issueHref">;
  children: ReactNode;
  className?: string;
}) {
  const href = attentionIssueHref(item);
  if (!href) return <>{children}</>;

  if (isExternalAttentionHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
