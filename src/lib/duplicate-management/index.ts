export type {
  CompanyDuplicateCluster,
  CompanyMatchReason,
  CompanyMergeResult,
  ContactDuplicatePair,
  DuplicateCompanyMember,
  DuplicateConfidence,
  DuplicateScanResult,
} from "@/lib/duplicate-management/types";

export { findCompanyDuplicateClusters } from "@/lib/duplicate-management/company-duplicates";
export { findPortfolioContactDuplicates } from "@/lib/duplicate-management/contact-duplicates";
export { mergeCompanies } from "@/lib/duplicate-management/merge-companies";
export {
  companyClusterDismissKey,
  clusterDismissKeyFromCluster,
  dismissCompanyCluster,
  filterDismissedCompanyClusters,
  listDismissedCompanyClusterKeys,
} from "@/lib/duplicate-management/dismissals";
export {
  loadCompanyDuplicateHint,
  type CompanyDuplicateHint,
} from "@/lib/duplicate-management/company-hint";
