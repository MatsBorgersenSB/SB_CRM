import {
  buildM365RelationshipCard,
  loadM365DataContext,
  resolveCompanyFromInput,
} from "@/lib/m365";
import { m365Error, m365Json } from "@/lib/m365/api-response";
import { mergeLiveMailIntoEvidence } from "@/lib/company-correspondence";
import { loadCorrespondenceEvidenceForCompany } from "@/lib/company-correspondence-data";
import { getPrisma } from "@/lib/prisma";
import { readProjects } from "@/lib/project-db";
import { getProjectsForCompany } from "@/lib/project-team-utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const email = searchParams.get("email");
  const projectName = searchParams.get("projectName");

  if (!companyId && !email) {
    return m365Error("Provide companyId or email query parameter", 400);
  }

  try {
    const ctx = await loadM365DataContext();
    const resolved = resolveCompanyFromInput(
      ctx.companies,
      companyId ? { companyId } : { email: email! },
    );

    if (!resolved) {
      return m365Error("No matching account found for this context", 404);
    }

    const stored = await loadCorrespondenceEvidenceForCompany(resolved.company);
    let correspondence = mergeLiveMailIntoEvidence(stored, {
      liveCorrespondentEmail: email,
      liveProjectName: projectName,
    });

    // Learn from project membership + project-tagged mail for this sender.
    if (correspondence.projectLinkedCount === 0) {
      const projects = await readProjects();
      const linkedProjects = getProjectsForCompany(
        resolved.company.CompanyID,
        projects,
      );
      const prisma = getPrisma();
      const normalizedEmail = email?.trim().toLowerCase();
      const tagged = normalizedEmail
        ? await prisma.emailMessageRecord.findFirst({
            where: {
              isDeletedInSource: false,
              projectId: { not: null },
              OR: [
                { senderEmail: normalizedEmail },
                { recipientEmails: { has: normalizedEmail } },
              ],
            },
            select: { projectName: true, projectId: true },
            orderBy: { sentAt: "desc" },
          })
        : null;

      const inferredName =
        projectName?.trim() ||
        tagged?.projectName?.trim() ||
        linkedProjects[0]?.name ||
        null;

      if (inferredName || linkedProjects.length > 0 || tagged?.projectId) {
        correspondence = {
          ...correspondence,
          messageCount: Math.max(correspondence.messageCount, 1),
          projectLinkedCount: Math.max(correspondence.projectLinkedCount, 1),
          projectNames:
            inferredName && !correspondence.projectNames.includes(inferredName)
              ? [...correspondence.projectNames, inferredName]
              : correspondence.projectNames,
          lastSentAt: correspondence.lastSentAt ?? new Date().toISOString(),
        };
      }
    }

    return m365Json(
      buildM365RelationshipCard(resolved.company, ctx, { correspondence }),
    );
  } catch {
    return m365Error("Failed to build relationship card intelligence", 500);
  }
}
