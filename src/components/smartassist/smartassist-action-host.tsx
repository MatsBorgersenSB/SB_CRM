"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SmartAssistEmailAssistant } from "@/components/smartassist/smartassist-email-assistant";
import { isDraftEmailAction, prepareSmartAssistEmail } from "@/lib/smartassist-email-engine";
import { type SuggestedActivity } from "@/lib/activity-workspace";
import { stashSmartAssistPrefill } from "@/lib/smart-assist-prefill";
import type { AttentionItem } from "@/types/attention-item";
import type { CreateActivityInput } from "@/types/activity";

/**
 * Routes SmartAssist recommendations to action-specific assistants — never generic flows by default.
 */
export function useSmartAssistActionHost({
  ownerName,
  onOpenActivityWizard,
}: {
  ownerName: string;
  onOpenActivityWizard?: (preset: Partial<CreateActivityInput>) => void;
}) {
  const router = useRouter();
  const [emailItem, setEmailItem] = useState<AttentionItem | null>(null);

  const emailBriefing = useMemo(
    () =>
      emailItem
        ? prepareSmartAssistEmail(emailItem, {
            ownerName,
            contactName:
              emailItem.objectType === "Contact" ? emailItem.sourceObjectName : undefined,
          })
        : null,
    [emailItem, ownerName],
  );

  const openEmailAssistant = useCallback((item: AttentionItem) => {
    setEmailItem(item);
  }, []);

  const closeEmailAssistant = useCallback(() => setEmailItem(null), []);

  const executeAttentionPrimaryAction = useCallback(
    (item: AttentionItem) => {
      if (isDraftEmailAction(item)) {
        openEmailAssistant(item);
        return;
      }
      if (onOpenActivityWizard) {
        onOpenActivityWizard({});
        return;
      }
      router.push(item.href);
    },
    [onOpenActivityWizard, openEmailAssistant, router],
  );

  const executeSuggestion = useCallback(
    (suggestion: SuggestedActivity) => {
      if (suggestion.assistantKind === "email") {
        openEmailAssistant(suggestion.attentionItem);
        return;
      }
      if (onOpenActivityWizard) {
        onOpenActivityWizard(suggestion.preset);
        return;
      }
      stashSmartAssistPrefill({
        ActivityType: suggestion.preset.ActivityType,
        Subject: suggestion.preset.Subject,
        companyId:
          suggestion.preset.Company && "CompanyID" in suggestion.preset.Company
            ? suggestion.preset.Company.CompanyID
            : undefined,
        contactId:
          suggestion.preset.Contact && "ContactID" in suggestion.preset.Contact
            ? suggestion.preset.Contact.ContactID
            : undefined,
        dealId:
          suggestion.preset.Deal && "DealID" in suggestion.preset.Deal
            ? suggestion.preset.Deal.DealID
            : undefined,
        knowledgeDraft: {
          Summary: suggestion.preset.Summary,
          NextAction: suggestion.preset.NextAction,
          ActionRequired: suggestion.preset.ActionRequired,
          ActionStatus: suggestion.preset.ActionStatus,
        },
      });
      router.push("/activities");
    },
    [onOpenActivityWizard, openEmailAssistant, router],
  );

  const EmailAssistantModal =
    emailItem && emailBriefing ? (
      <SmartAssistEmailAssistant
        briefing={emailBriefing}
        attentionItem={emailItem}
        contactPhone={emailItem.contactPhone}
        onClose={closeEmailAssistant}
      />
    ) : null;

  return {
    openEmailAssistant,
    executeAttentionPrimaryAction,
    executeSuggestion,
    EmailAssistantModal,
  };
}
