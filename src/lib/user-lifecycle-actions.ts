import {
  analyzeUserOwnership,
  type LifecycleContext,
} from "@/lib/user-lifecycle-analysis";
import type { SharePointPerson } from "@/types/company";
import type { OwnershipTransferResult, StandardBioUserRecord } from "@/types/user-access";

/** Server-only lifecycle mutations — uses fs-backed stores. */

function userToSharePointPerson(
  user: Pick<StandardBioUserRecord, "id" | "displayName">,
): SharePointPerson {
  return { Id: user.id, Title: user.displayName };
}

export async function loadLifecycleContext(): Promise<LifecycleContext> {
  const { readActivities, readCompanies, readPipelines, readSmartDocsLibrary } =
    await import("@/lib/pipeline-db");
  const { readUsers } = await import("@/lib/users-access-db");

  const [companies, pipelines, activities, smartDocs, users] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readSmartDocsLibrary(),
    readUsers(),
  ]);

  return { companies, pipelines, activities, smartDocs, users };
}

export async function executeOwnershipTransfer(
  fromUser: StandardBioUserRecord,
  toUser: StandardBioUserRecord,
  context: LifecycleContext,
): Promise<OwnershipTransferResult> {
  const { updateActivity, updateCompany, updatePipeline } = await import("@/lib/pipeline-db");
  const analysis = analyzeUserOwnership(fromUser, context);
  const toPerson = userToSharePointPerson(toUser);

  for (const companyRef of analysis.ownedCompanies) {
    await updateCompany(companyRef.id, { AccountOwner: toPerson });
  }

  for (const oppRef of analysis.ownedOpportunities) {
    await updatePipeline(oppRef.id, { opportunityOwner: toPerson });
  }

  for (const activityRef of analysis.ownedActivities) {
    await updateActivity(activityRef.id, { ActivityOwner: toPerson });
  }

  const transferredCompanyIds = analysis.ownedCompanies.map((record) => record.id);
  const fromOwned = fromUser.ownedCompanyIds.filter(
    (id) => !transferredCompanyIds.includes(id),
  );
  const toOwned = Array.from(new Set([...toUser.ownedCompanyIds, ...transferredCompanyIds]));

  const { updateUser } = await import("@/lib/users-access-db");
  await updateUser(fromUser.id, { ownedCompanyIds: fromOwned });
  await updateUser(toUser.id, { ownedCompanyIds: toOwned });

  return {
    transferred: {
      companies: analysis.ownedCompanies.length,
      contacts: analysis.ownedContacts.length,
      opportunities: analysis.ownedOpportunities.length,
      activities: analysis.ownedActivities.length,
      documents: analysis.ownedDocuments.length,
      openCommitments: analysis.openCommitments.length,
    },
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    completedAt: new Date().toISOString(),
  };
}
