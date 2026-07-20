import type { ActivityType, CreateActivityInput, SmartAssistAssessment } from "@/types/activity";

const STORAGE_KEY = "smartcrm-smartassist-prefill";

export type SmartAssistActivityPrefill = {
  ActivityType?: string;
  Subject?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  planDate?: string;
  /** Open wizard in record/knowledge capture mode */
  recordMode?: boolean;
  /** Pre-filled knowledge fields from SmartAssist */
  knowledgeDraft?: Partial<CreateActivityInput> & {
    SmartAssistAssessment?: SmartAssistAssessment;
  };
};

export function stashSmartAssistPrefill(prefill: SmartAssistActivityPrefill): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
}

export function consumeSmartAssistPrefill(): SmartAssistActivityPrefill | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as SmartAssistActivityPrefill;
  } catch {
    return null;
  }
}

export function prefillToCreateActivityInput(
  prefill: SmartAssistActivityPrefill,
): Partial<CreateActivityInput> {
  const draft = prefill.knowledgeDraft ?? {};
  return {
    ...(prefill.ActivityType
      ? { ActivityType: prefill.ActivityType as ActivityType }
      : {}),
    ...(prefill.Subject ? { Subject: prefill.Subject } : {}),
    ...(prefill.companyId ? { Company: { CompanyID: prefill.companyId } } : {}),
    ...(prefill.contactId ? { Contact: { ContactID: prefill.contactId } } : {}),
    ...(prefill.dealId ? { Deal: { DealID: prefill.dealId } } : {}),
    ...(prefill.planDate ? { ActivityDate: `${prefill.planDate}T09:00:00` } : {}),
    ...(prefill.recordMode ? { ActionStatus: "Completed" as const } : {}),
    ...draft,
  };
}
