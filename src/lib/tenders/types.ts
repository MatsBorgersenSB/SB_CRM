import type {
  TenderSectorTag,
  TenderSource,
  TenderStatus,
  TenderTechnologyType,
} from "@/lib/tenders/thermalFilter";

export const TENDER_SELECT = {
  id: true,
  externalId: true,
  source: true,
  title: true,
  authorityName: true,
  country: true,
  publicationDate: true,
  submissionDeadline: true,
  estimatedBudget: true,
  sectorTag: true,
  technologyType: true,
  summary: true,
  rawUrl: true,
  status: true,
  classifierConfidence: true,
  promotedCompanyId: true,
  promotedOpportunityId: true,
} as const;

export type TenderRecord = {
  id: string;
  externalId: string;
  source: TenderSource;
  title: string;
  authorityName: string;
  country: string;
  publicationDate: Date;
  submissionDeadline: Date;
  estimatedBudget: number | null;
  sectorTag: TenderSectorTag;
  technologyType: TenderTechnologyType;
  summary: string;
  rawUrl: string | null;
  status: TenderStatus;
  classifierConfidence: number | null;
  promotedCompanyId: string | null;
  promotedOpportunityId: string | null;
};

export type TenderListItem = {
  id: string;
  externalId: string;
  source: TenderSource;
  title: string;
  authorityName: string;
  country: string;
  publicationDate: string;
  submissionDeadline: string;
  estimatedBudget: number | null;
  sectorTag: TenderSectorTag;
  technologyType: TenderTechnologyType;
  summary: string;
  rawUrl: string | null;
  status: TenderStatus;
  classifierConfidence: number | null;
  daysLeft: number;
};

export type SmartAssistTenderClassification = {
  qualified: boolean;
  confidence: number;
  technologyType: TenderTechnologyType;
  sectorTag: TenderSectorTag;
  summary: string;
};
