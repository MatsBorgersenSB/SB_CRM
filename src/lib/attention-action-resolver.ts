import { outlookComposeHref } from "@/lib/compose-actions";
import type { AttentionAction, AttentionItem } from "@/types/attention-item";
import { company360Href } from "@/types/company-360";
import { deal360Href } from "@/types/relationship-navigation";

const MEETING_SUBJECT = "Follow-up meeting";

/**
 * Resolves executable actions for an attention item.
 * Maps rule signals → draft email, schedule meeting, navigate, etc.
 */
export function resolveAttentionActions(item: AttentionItem): AttentionAction[] {
  const actions: AttentionAction[] = [];
  const email = item.contactEmail;
  const phone = item.contactPhone;

  const pushDraftEmail = (subject?: string) => {
    if (!email) return;
    actions.push({
      kind: "draft_email",
      label: "Draft Email",
      href: outlookComposeHref(email, subject),
      email,
    });
  };

  const pushScheduleMeeting = () => {
    if (email) {
      actions.push({
        kind: "schedule_meeting",
        label: "Schedule Meeting",
        href: outlookComposeHref(email, MEETING_SUBJECT),
        email,
      });
    } else {
      actions.push({
        kind: "schedule_meeting",
        label: "Schedule Meeting",
        href: item.href,
      });
    }
  };

  switch (item.ruleId) {
    case "overdue_followup":
    case "complete_overdue_commitment":
      actions.push({
        kind: "complete_commitment",
        label: "Complete Commitment",
        href: item.href,
      });
      pushDraftEmail();
      break;

    case "no_activity":
    case "no_recent_contact":
    case "schedule_follow_up_call":
    case "log_first_interaction":
      pushDraftEmail();
      pushScheduleMeeting();
      actions.push({
        kind: "create_activity",
        label: "Create Activity",
        href: item.companyId
          ? `${company360Href(item.companyId)}#contacts`
          : "/activities",
      });
      break;

    case "missing_stakeholders":
    case "add_primary_contact":
    case "engage_additional_stakeholders":
      actions.push({
        kind: "create_contact",
        label: "Create Contact",
        href: item.companyId
          ? `${company360Href(item.companyId)}#contacts`
          : item.href,
      });
      pushDraftEmail();
      break;

    case "stalled_opportunity":
    case "follow_up_proposal":
    case "re_engage_stalled":
      pushDraftEmail();
      pushScheduleMeeting();
      actions.push({
        kind: "navigate",
        label: "Open Opportunity",
        href: item.href,
      });
      break;

    case "incomplete_document_set":
      actions.push({
        kind: "build_document_set",
        label: "Build Document Set",
        href: item.href,
      });
      break;

    case "package_not_transmitted":
      actions.push({
        kind: "create_transmission_package",
        label: "Create Transmission Package",
        href: item.href,
      });
      pushDraftEmail();
      break;

    case "risk_threshold_exceeded":
    case "document_risk":
      actions.push({
        kind: "navigate",
        label: "Review",
        href: item.href,
      });
      pushDraftEmail();
      break;

    case "due_today":
      if (item.objectType === "Activity") {
        actions.push({
          kind: "complete_commitment",
          label: "Complete",
          href: item.href,
        });
      }
      pushDraftEmail();
      break;

    case "maintain_momentum":
    case "record_today_interaction":
      actions.push({
        kind: "create_activity",
        label: "Log Activity",
        href: item.companyId
          ? company360Href(item.companyId)
          : "/activities",
      });
      break;

    default:
      if (item.objectType === "Opportunity") {
        actions.push({
          kind: "navigate",
          label: "Open Deal",
          href: item.href || deal360Href(item.sourceObjectId),
        });
      } else if (item.objectType === "Contact" && email) {
        pushDraftEmail();
      } else if (item.objectType === "Contact" && phone) {
        actions.push({
          kind: "navigate",
          label: "Open Contact",
          href: item.href,
          phone,
        });
      } else {
        actions.push({
          kind: "navigate",
          label: "Open",
          href: item.href,
        });
      }
      break;
  }

  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.kind}-${action.href ?? action.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
