import { isFollowUpOpen } from "@/lib/activity-utils";
import { resolveOpportunityOwner } from "@/lib/opportunity-owner";
import type { Activity } from "@/types/activity";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type {
  OwnedEntityRef,
  OwnershipTransferPreview,
  StandardBioUserRecord,
  SuccessorRecommendation,
  TransferRiskLevel,
  UserOwnershipAnalysis,
} from "@/types/user-access";

/** Pure lifecycle analysis — safe for client and server bundles (no fs). */

export type LifecycleContext = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  smartDocs: SmartDocLibraryRecord[];
  users: StandardBioUserRecord[];
};

export function matchesOwner(
  person: SharePointPerson | null | undefined,
  user: Pick<StandardBioUserRecord, "id" | "displayName">,
): boolean {
  if (!person?.Title?.trim()) return false;
  return (
    person.Id === user.id ||
    person.Title.trim().toLowerCase() === user.displayName.trim().toLowerCase()
  );
}

function pipelineCompany(
  pipeline: PipelineRow,
  companies: Company[],
): Company | undefined {
  return companies.find((company) => company.pipelineIds.includes(pipeline.id));
}

export function analyzeUserOwnership(
  user: StandardBioUserRecord,
  context: LifecycleContext,
): UserOwnershipAnalysis {
  const { companies, pipelines, activities, smartDocs } = context;

  const ownedCompanies: OwnedEntityRef[] = companies
    .filter((company) => matchesOwner(company.AccountOwner, user))
    .map((company) => ({
      id: company.CompanyID,
      label: company.Title,
      href: `/companies/${company.CompanyID}`,
    }));

  const ownedCompanyIds = new Set(ownedCompanies.map((record) => record.id));

  const ownedContacts: OwnedEntityRef[] = companies.flatMap((company) => {
    if (!ownedCompanyIds.has(company.CompanyID)) return [];
    return company.contacts.map((contact) => ({
      id: contact.ContactID,
      label: `${contact.Title} · ${company.Title}`,
      href: `/companies/${company.CompanyID}`,
    }));
  });

  const ownedOpportunities: OwnedEntityRef[] = [];
  const ownedDealIds = new Set<string>();

  for (const pipeline of pipelines) {
    const company = pipelineCompany(pipeline, companies);
    const owner = resolveOpportunityOwner(pipeline, company);
    const explicitOwner = pipeline.opportunityOwner?.Title?.trim()
      ? pipeline.opportunityOwner
      : null;

    if (matchesOwner(explicitOwner, user) || (!explicitOwner && matchesOwner(owner, user))) {
      ownedOpportunities.push({
        id: pipeline.id,
        label: pipeline.assetName ?? pipeline.id,
        href: `/deals/${pipeline.id}`,
      });
      ownedDealIds.add(pipeline.id);
    }
  }

  const ownedActivities: OwnedEntityRef[] = activities
    .filter((activity) => matchesOwner(activity.ActivityOwner, user))
    .map((activity) => ({
      id: activity.ActivityID,
      label: activity.Subject,
      href: `/activities/${activity.ActivityID}`,
    }));

  const openCommitments: OwnedEntityRef[] = activities
    .filter((activity) => matchesOwner(activity.ActivityOwner, user) && isFollowUpOpen(activity))
    .map((activity) => ({
      id: activity.ActivityID,
      label: activity.NextAction || activity.Subject,
      href: `/activities/${activity.ActivityID}`,
    }));

  const ownedDocuments: OwnedEntityRef[] = smartDocs
    .filter((doc) => {
      if (ownedDealIds.has(doc.DealId)) return true;
      const company = companies.find(
        (record) =>
          record.Title === doc.ClientName || ownedCompanyIds.has(record.CompanyID),
      );
      return Boolean(company && ownedCompanyIds.has(company.CompanyID));
    })
    .map((doc) => ({
      id: doc.SmartDocID,
      label: doc.DocumentName,
      href: `/deals/${doc.DealId}`,
    }));

  const totalRecords =
    ownedCompanies.length +
    ownedContacts.length +
    ownedOpportunities.length +
    ownedActivities.length +
    ownedDocuments.length;

  const hasOwnership =
    ownedCompanies.length > 0 ||
    ownedOpportunities.length > 0 ||
    ownedActivities.length > 0;

  return {
    userId: user.id,
    displayName: user.displayName,
    ownedCompanies,
    ownedContacts,
    ownedOpportunities,
    ownedActivities,
    ownedDocuments,
    openCommitments,
    totalRecords,
    hasOwnership,
    canDelete: !hasOwnership,
    deleteBlockedReason: hasOwnership
      ? `${ownedCompanies.length} companies, ${ownedOpportunities.length} opportunities, and ${ownedActivities.length} activities require ownership transfer before deletion.`
      : undefined,
  };
}

type WorkloadMap = Map<number, number>;

function buildWorkloadMap(context: LifecycleContext): WorkloadMap {
  const workload = new Map<number, number>();
  for (const user of context.users) {
    if (user.status !== "active") continue;
    const analysis = analyzeUserOwnership(user, context);
    workload.set(
      user.id,
      analysis.ownedCompanies.length +
        analysis.ownedOpportunities.length +
        analysis.ownedActivities.length,
    );
  }
  return workload;
}

function countTerritoryOverlap(
  departing: StandardBioUserRecord,
  candidate: StandardBioUserRecord,
  context: LifecycleContext,
): number {
  const departingCompanies = new Set(
    analyzeUserOwnership(departing, context).ownedCompanies.map((record) => record.id),
  );
  let overlap = 0;
  for (const companyId of candidate.ownedCompanyIds) {
    if (departingCompanies.has(companyId)) overlap += 1;
  }
  for (const company of context.companies) {
    if (
      departingCompanies.has(company.CompanyID) &&
      matchesOwner(company.AccountOwner, candidate)
    ) {
      overlap += 1;
    }
  }
  return overlap;
}

function countRelationshipScore(
  departing: StandardBioUserRecord,
  candidate: StandardBioUserRecord,
  context: LifecycleContext,
): number {
  const departingCompanyIds = new Set(
    analyzeUserOwnership(departing, context).ownedCompanies.map((record) => record.id),
  );
  let score = 0;
  for (const activity of context.activities) {
    if (!matchesOwner(activity.ActivityOwner, candidate)) continue;
    const companyId = activity.Company?.Title
      ? context.companies.find((company) => company.Title === activity.Company?.Title)
          ?.CompanyID
      : undefined;
    if (companyId && departingCompanyIds.has(companyId)) {
      score += 1;
    }
  }
  return score;
}

function countOpportunityOverlap(
  departing: StandardBioUserRecord,
  candidate: StandardBioUserRecord,
  context: LifecycleContext,
): number {
  const departingDealIds = new Set(
    analyzeUserOwnership(departing, context).ownedOpportunities.map((record) => record.id),
  );
  let overlap = 0;
  for (const pipeline of context.pipelines) {
    if (!departingDealIds.has(pipeline.id)) continue;
    const company = pipelineCompany(pipeline, context.companies);
    const owner = resolveOpportunityOwner(pipeline, company);
    if (matchesOwner(owner, candidate)) overlap += 1;
  }
  return overlap;
}

export function recommendSuccessors(
  departingUser: StandardBioUserRecord,
  context: LifecycleContext,
  limit = 5,
): SuccessorRecommendation[] {
  const workload = buildWorkloadMap(context);
  const maxWorkload = Math.max(1, ...Array.from(workload.values()));

  const recommendations: SuccessorRecommendation[] = [];

  for (const candidate of context.users) {
    if (candidate.id === departingUser.id) continue;
    if (candidate.status !== "active") continue;

    const teamMatch = candidate.team === departingUser.team;
    const roleMatch = candidate.role === departingUser.role;
    const territoryOverlap = countTerritoryOverlap(departingUser, candidate, context);
    const relationshipScore = countRelationshipScore(departingUser, candidate, context);
    const candidateWorkload = workload.get(candidate.id) ?? 0;
    const workloadScore = Math.max(0, maxWorkload - candidateWorkload);
    const opportunityOverlap = countOpportunityOverlap(departingUser, candidate, context);

    let score = 0;
    if (teamMatch) score += 25;
    if (roleMatch) score += 20;
    score += Math.min(territoryOverlap * 10, 20);
    score += Math.min(relationshipScore * 5, 15);
    score += Math.round((workloadScore / maxWorkload) * 15);
    score += Math.min(opportunityOverlap * 5, 15);

    if (candidate.role === "commercial" && departingUser.role === "commercial") {
      score += 10;
    }
    if (candidate.ownershipScope === "portfolio" || candidate.ownershipScope === "global") {
      score += 5;
    }

    const rationaleParts: string[] = [];
    if (teamMatch) rationaleParts.push(`same ${candidate.team} team`);
    if (roleMatch && candidate.role) rationaleParts.push(`matching ${candidate.role} role`);
    if (territoryOverlap > 0) {
      rationaleParts.push(`${territoryOverlap} shared account${territoryOverlap === 1 ? "" : "s"}`);
    }
    if (relationshipScore > 0) {
      rationaleParts.push(`${relationshipScore} existing relationship activities`);
    }
    if (candidateWorkload <= 2) rationaleParts.push("light current workload");
    if (opportunityOverlap > 0) {
      rationaleParts.push(`${opportunityOverlap} related opportunities`);
    }

    recommendations.push({
      user: {
        id: candidate.id,
        userId: candidate.userId,
        displayName: candidate.displayName,
        role: candidate.role,
        team: candidate.team,
        businessFunction: candidate.businessFunction,
      },
      confidencePercent: Math.min(98, Math.max(40, score)),
      rationale:
        rationaleParts.length > 0
          ? `Recommended because of ${rationaleParts.join(", ")}.`
          : "Available active user with capacity to absorb ownership.",
      factors: {
        teamMatch,
        roleMatch,
        territoryOverlap,
        relationshipScore,
        workloadScore: candidateWorkload,
        opportunityOverlap,
      },
    });
  }

  return recommendations
    .sort((a, b) => b.confidencePercent - a.confidencePercent)
    .slice(0, limit);
}

function assessRisk(
  analysis: UserOwnershipAnalysis,
): { level: TransferRiskLevel; assessment: string } {
  const { openCommitments, ownedCompanies, ownedOpportunities, ownedActivities } = analysis;

  if (openCommitments.length >= 3 || ownedOpportunities.length >= 5) {
    return {
      level: "high",
      assessment: `High risk: ${openCommitments.length} open commitments and ${ownedOpportunities.length} opportunities will change owner. Review successor capacity before confirming.`,
    };
  }

  if (ownedCompanies.length >= 2 || ownedActivities.length >= 5) {
    return {
      level: "medium",
      assessment: `Medium risk: ${ownedCompanies.length} companies and ${ownedActivities.length} activities will transfer. Successor should be briefed on active relationships.`,
    };
  }

  return {
    level: "low",
    assessment: "Low risk: limited ownership footprint. Transfer can proceed with minimal disruption.",
  };
}

export function buildTransferPreview(
  departingUser: StandardBioUserRecord,
  context: LifecycleContext,
  selectedNewOwnerId?: number,
): OwnershipTransferPreview {
  const analysis = analyzeUserOwnership(departingUser, context);
  const successorRecommendations = recommendSuccessors(departingUser, context);
  const suggestedNewOwner = successorRecommendations[0] ?? null;

  const selectedUser =
    (selectedNewOwnerId
      ? context.users.find((user) => user.id === selectedNewOwnerId)
      : suggestedNewOwner
        ? context.users.find((user) => user.id === suggestedNewOwner.user.id)
        : null) ?? null;

  const { level, assessment } = assessRisk(analysis);

  const previewChanges: OwnershipTransferPreview["previewChanges"] = [];

  for (const company of analysis.ownedCompanies) {
    previewChanges.push({
      entityType: "Company",
      entityId: company.id,
      entityLabel: company.label,
      field: "AccountOwner",
      from: departingUser.displayName,
      to: selectedUser?.displayName ?? "—",
    });
  }

  for (const opportunity of analysis.ownedOpportunities) {
    previewChanges.push({
      entityType: "Opportunity",
      entityId: opportunity.id,
      entityLabel: opportunity.label,
      field: "opportunityOwner",
      from: departingUser.displayName,
      to: selectedUser?.displayName ?? "—",
    });
  }

  for (const activity of analysis.ownedActivities) {
    previewChanges.push({
      entityType: "Activity",
      entityId: activity.id,
      entityLabel: activity.label,
      field: "ActivityOwner",
      from: departingUser.displayName,
      to: selectedUser?.displayName ?? "—",
    });
  }

  return {
    currentOwner: {
      id: departingUser.id,
      displayName: departingUser.displayName,
      userId: departingUser.userId,
    },
    suggestedNewOwner,
    selectedNewOwner: selectedUser
      ? { id: selectedUser.id, displayName: selectedUser.displayName, userId: selectedUser.userId }
      : null,
    riskLevel: level,
    riskAssessment: assessment,
    affectedRecords: {
      companies: analysis.ownedCompanies.length,
      contacts: analysis.ownedContacts.length,
      opportunities: analysis.ownedOpportunities.length,
      activities: analysis.ownedActivities.length,
      documents: analysis.ownedDocuments.length,
      openCommitments: analysis.openCommitments.length,
    },
    previewChanges,
    successorRecommendations,
  };
}

export function findOrphanedRecords(context: LifecycleContext): OwnedEntityRef[] {
  const inactiveUsers = context.users.filter(
    (user) => user.status === "disabled" || user.status === "archived" || user.status === "inactive",
  );
  const orphaned: OwnedEntityRef[] = [];

  for (const user of inactiveUsers) {
    const analysis = analyzeUserOwnership(user, context);
    if (!analysis.hasOwnership) continue;
    for (const company of analysis.ownedCompanies) {
      orphaned.push({
        ...company,
        label: `${company.label} · owned by ${user.displayName} (${user.status})`,
      });
    }
  }

  return orphaned;
}
