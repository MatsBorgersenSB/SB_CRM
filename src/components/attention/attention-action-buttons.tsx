"use client";

import Link from "next/link";
import type { AttentionAction, AttentionItem } from "@/types/attention-item";
import { ActionMenu, ActionMenuItem } from "@/components/relationship/action-menu";
import { m365ComposeHref, mailtoHref, telHref } from "@/lib/compose-actions";
import { IconLabel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import type { SmartCRMIconName } from "@/lib/smartcrm-visual-language";

const ACTION_ICONS: Partial<Record<AttentionAction["kind"], SmartCRMIconName>> = {
  draft_email: "email",
  schedule_meeting: "meeting",
  create_contact: "contact",
  create_activity: "meeting",
  build_document_set: "documentSet",
  create_transmission_package: "documentSet",
  navigate: "search",
  complete_commitment: "healthy",
};

export function AttentionActionButtons({
  actions,
  attentionItem,
  onDraftEmail,
  onNoAction,
  compact = false,
}: {
  actions: AttentionAction[];
  attentionItem?: AttentionItem;
  onDraftEmail?: (item: AttentionItem) => void;
  /** User explicitly chooses not to act on this attention item. */
  onNoAction?: (item: AttentionItem) => void;
  compact?: boolean;
}) {
  if (actions.length === 0 && !onNoAction) return null;

  const showMenu = actions.length > 1 || Boolean(onNoAction && attentionItem);

  if (!showMenu && actions.length === 1) {
    const action = actions[0]!;
    return (
      <AttentionActionButton
        action={action}
        attentionItem={attentionItem}
        onDraftEmail={onDraftEmail}
        compact={compact}
      />
    );
  }

  return (
    <ActionMenu
      label={
        <IconLabel icon="search" iconSize="xs">
          {compact ? "Actions" : "Take action"}
        </IconLabel>
      }
      align="right"
      className="text-[11px] font-semibold text-upcycle-orange"
    >
      {actions.map((action) => (
        <AttentionActionEntries
          key={`${action.kind}-${action.label}`}
          action={action}
          attentionItem={attentionItem}
          onDraftEmail={onDraftEmail}
        />
      ))}
      {attentionItem && onNoAction ? (
        <>
          <div className="my-1 border-t border-carbon-blue/10" role="separator" />
          <ActionMenuItem onClick={() => onNoAction(attentionItem)}>
            <span className="inline-flex items-center gap-1.5 text-carbon-blue/55">
              <SmartCRMIcon name="healthy" size="xs" />
              No Action
            </span>
          </ActionMenuItem>
        </>
      ) : null}
    </ActionMenu>
  );
}

function ActionLabel({ action }: { action: AttentionAction }) {
  const icon = ACTION_ICONS[action.kind];
  if (!icon) return <>{action.label}</>;
  return (
    <IconLabel icon={icon} iconSize="xs">
      {action.label}
    </IconLabel>
  );
}

/** Flat menu entries — no nested ActionMenu (nested portals broke mail link clicks). */
function AttentionActionEntries({
  action,
  attentionItem,
  onDraftEmail,
}: {
  action: AttentionAction;
  attentionItem?: AttentionItem;
  onDraftEmail?: (item: AttentionItem) => void;
}) {
  if (action.kind === "draft_email" && attentionItem && onDraftEmail) {
    return (
      <ActionMenuItem onClick={() => onDraftEmail(attentionItem)}>
        <ActionLabel action={action} />
      </ActionMenuItem>
    );
  }

  if (action.kind === "draft_email" && action.email) {
    return (
      <>
        <ActionMenuItem href={m365ComposeHref(action.email)} external>
          <IconLabel icon="email" iconSize="xs">
            Outlook Web
          </IconLabel>
        </ActionMenuItem>
        <ActionMenuItem href={mailtoHref(action.email)}>
          <IconLabel icon="email" iconSize="xs">
            Default mail app
          </IconLabel>
        </ActionMenuItem>
      </>
    );
  }

  return (
    <AttentionActionButton
      action={action}
      attentionItem={attentionItem}
      onDraftEmail={onDraftEmail}
      asMenuItem
    />
  );
}

function AttentionActionButton({
  action,
  attentionItem,
  onDraftEmail,
  compact = false,
  asMenuItem = false,
}: {
  action: AttentionAction;
  attentionItem?: AttentionItem;
  onDraftEmail?: (item: AttentionItem) => void;
  compact?: boolean;
  asMenuItem?: boolean;
}) {
  const className = asMenuItem
    ? "block w-full px-3 py-1.5 text-left text-[11px] font-medium text-carbon-blue hover:bg-carbon-blue/[0.04]"
    : `inline-flex items-center gap-1 border border-carbon-blue/12 px-2.5 py-1 text-[10px] font-semibold text-carbon-blue transition-colors hover:border-upcycle-orange/30 hover:text-upcycle-orange ${
        compact ? "" : ""
      }`;

  const label = <ActionLabel action={action} />;

  if (action.kind === "draft_email" && attentionItem && onDraftEmail) {
    return (
      <button type="button" onClick={() => onDraftEmail(attentionItem)} className={className}>
        {label}
      </button>
    );
  }

  if (action.kind === "draft_email" && action.email) {
    if (asMenuItem) {
      return (
        <>
          <a
            href={m365ComposeHref(action.email)}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
          >
            <IconLabel icon="email" iconSize="xs">
              Outlook Web
            </IconLabel>
          </a>
          <a href={mailtoHref(action.email)} className={className}>
            <IconLabel icon="email" iconSize="xs">
              Default mail app
            </IconLabel>
          </a>
        </>
      );
    }
    return (
      <ActionMenu
        label={label}
        align="right"
        className="text-[10px] font-semibold text-carbon-blue"
      >
        <ActionMenuItem href={m365ComposeHref(action.email)} external>
          <IconLabel icon="email" iconSize="xs">
            Outlook Web
          </IconLabel>
        </ActionMenuItem>
        <ActionMenuItem href={mailtoHref(action.email)}>
          <IconLabel icon="email" iconSize="xs">
            Default mail app
          </IconLabel>
        </ActionMenuItem>
      </ActionMenu>
    );
  }

  if (
    action.href?.startsWith("http") ||
    action.href?.startsWith("mailto:") ||
    action.href?.startsWith("tel:")
  ) {
    return (
      <a href={action.href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  if (action.phone && action.kind === "navigate") {
    return (
      <a href={telHref(action.phone)} className={className}>
        {label}
      </a>
    );
  }

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {label}
      </Link>
    );
  }

  return <span className={className}>{label}</span>;
}
