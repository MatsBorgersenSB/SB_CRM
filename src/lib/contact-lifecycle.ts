export {
  analyzeContactLifecycle,
  analyzeContactRelationshipPortfolio,
  buildCareerTimeline,
  buildCurrentCareerEntry,
  countPreservedReferences,
  findDuplicateContacts,
  normalizeEmploymentStatus,
  toActionableInsight,
  type ContactLifecycleContext,
} from "@/lib/contact-lifecycle-engine";

export {
  auditContactLifecycle,
  executeContactArchive,
  executeContactMerge,
  executeContactTransfer,
  loadContactLifecycleContext,
  previewContactTransfer,
} from "@/lib/contact-lifecycle-actions";
