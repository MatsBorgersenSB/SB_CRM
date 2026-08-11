"use client";

import Link from "next/link";
import type { CommercialPackage } from "@/types/commercial-package";
import {
  commercialPackageHref,
  companyHref,
  contact360Href,
  deal360Href,
  documentHref,
  documentSetHref,
  project360Href,
} from "@/types/relationship-navigation";
import {
  copyTextToClipboard,
  m365ComposeHref,
  mailtoHref,
  outlookComposeHref,
  telHref,
} from "@/lib/compose-actions";
import { ActionMenu, ActionMenuItem } from "@/components/relationship/action-menu";
import { IconLabel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";

const linkClass =
  "inline-flex items-center gap-1.5 font-inherit text-inherit underline-offset-2 transition-colors hover:text-upcycle-orange hover:underline";

export function ContactLink({
  contactId,
  companyId,
  children,
  className = "",
  showIcon = true,
}: {
  contactId: string;
  companyId?: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <Link href={contact360Href(contactId, companyId)} className={`${linkClass} ${className}`}>
      {showIcon ? <SmartCRMIcon name="contact" size="xs" label="Contact" /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function CompanyLink({
  companyId,
  children,
  className = "",
  showIcon = true,
}: {
  companyId: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <Link href={companyHref(companyId)} className={`${linkClass} ${className}`}>
      {showIcon ? <SmartCRMIcon name="company" size="xs" label="Company" /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function DealLink({
  dealId,
  children,
  className = "",
  tab,
  showIcon = true,
}: {
  dealId: string;
  children: React.ReactNode;
  className?: string;
  tab?: Parameters<typeof deal360Href>[1];
  showIcon?: boolean;
}) {
  return (
    <Link href={deal360Href(dealId, tab)} className={`${linkClass} ${className}`}>
      {showIcon ? <SmartCRMIcon name="opportunity" size="xs" label="Opportunity" /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function ProjectLink({
  projectId,
  children,
  className = "",
  showIcon = true,
}: {
  projectId: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <Link href={project360Href(projectId)} className={`${linkClass} ${className}`}>
      {showIcon ? <SmartCRMIcon name="project" size="xs" label="Project" /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function DocumentLink({
  documentId,
  children,
  className = "",
  showIcon = true,
}: {
  documentId: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <Link href={documentHref(documentId)} className={`${linkClass} ${className}`}>
      {showIcon ? <SmartCRMIcon name="document" size="xs" label="Document" /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function DocumentSetLink({
  setId,
  children,
  className = "",
  showIcon = true,
}: {
  setId: string;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <Link href={documentSetHref(setId)} className={`${linkClass} ${className}`}>
      {showIcon ? <SmartCRMIcon name="documentSet" size="xs" label="Document set" /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function CommercialPackageLink({
  pkg,
  children,
  className = "",
  showIcon = true,
}: {
  pkg: CommercialPackage;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  const iconName =
    pkg.kind === "transmission" || pkg.kind === "execution" ? "documentSet" : "document";

  return (
    <Link href={commercialPackageHref(pkg)} className={`${linkClass} ${className}`}>
      {showIcon ? <SmartCRMIcon name={iconName} size="xs" /> : null}
      <span>{children}</span>
    </Link>
  );
}

export function EmailActionMenu({
  email,
  subject,
  className = "",
}: {
  email: string;
  subject?: string;
  className?: string;
}) {
  const trimmed = email.trim();
  if (!trimmed) return null;

  return (
    <ActionMenu
      label={
        <IconLabel icon="email" className="font-inherit">
          {trimmed}
        </IconLabel>
      }
      className={className}
    >
      <ActionMenuItem href={outlookComposeHref(trimmed, subject)} external>
        <IconLabel icon="email">Compose in Outlook</IconLabel>
      </ActionMenuItem>
      <ActionMenuItem href={m365ComposeHref(trimmed, subject)} external>
        <IconLabel icon="email">Compose in Microsoft 365</IconLabel>
      </ActionMenuItem>
      <ActionMenuItem href={mailtoHref(trimmed, subject)}>
        <IconLabel icon="email">Open mail app</IconLabel>
      </ActionMenuItem>
      <ActionMenuItem
        onClick={() => {
          void copyTextToClipboard(trimmed);
        }}
      >
        Copy email
      </ActionMenuItem>
    </ActionMenu>
  );
}

export function PhoneActionMenu({
  phone,
  className = "",
}: {
  phone: string;
  className?: string;
}) {
  const trimmed = decodePhoneLabel(phone);
  if (!trimmed) return null;

  return (
    <ActionMenu
      label={
        <IconLabel icon="phone" className="font-inherit">
          {trimmed}
        </IconLabel>
      }
      className={className}
    >
      <ActionMenuItem href={telHref(trimmed)}>
        <IconLabel icon="phone">Call</IconLabel>
      </ActionMenuItem>
      <ActionMenuItem
        onClick={() => {
          void copyTextToClipboard(trimmed);
        }}
      >
        Copy number
      </ActionMenuItem>
    </ActionMenu>
  );
}

function decodePhoneLabel(phone: string): string {
  let value = phone.trim();
  if (!value) return "";
  try {
    if (/%[0-9A-Fa-f]{2}/.test(value)) {
      value = decodeURIComponent(value);
    }
  } catch {
    value = value.replace(/%20/gi, " ");
  }
  return value.replace(/\s+/g, " ").trim();
}
