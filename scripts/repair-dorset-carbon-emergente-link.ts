/**
 * One-shot Reality First repair: remove DorsetGM (CO-1009) from Carbon Emergente
 * project organization links. Stakeholder people stay on the project; their org
 * membership is unassigned until a real company is linked on the project.
 *
 * Usage: npx tsx scripts/repair-dorset-carbon-emergente-link.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

import { getPrisma } from "../src/lib/prisma";
import { detachCompanyFromProject } from "../src/lib/project-relationship-utils";
import type { Project } from "../src/types/project";
import type { Prisma } from "../src/generated/prisma";

const PROJECT_ID = "PRJ-CARBON-EMERGENTE";
const FALSE_COMPANY_ID = "CO-1009";

async function main() {
  const prisma = getPrisma();

  try {
    const row = await prisma.projectWorkspace.findUnique({
      where: { id: PROJECT_ID },
    });

    if (!row) {
      throw new Error(`Project not found: ${PROJECT_ID}`);
    }

    const payload =
      row.data && typeof row.data === "object"
        ? (row.data as Project)
        : ({ id: row.id, name: row.name } as Project);
    const current = { ...payload, id: row.id };

    console.log("Before:", {
      linkedCompanyId: current.linkedCompanyId,
      relatedOrganizations: current.relatedOrganizations,
      externalStakeholders: (current.projectStakeholders ?? [])
        .filter((s) => s.organizationId !== "org-internal-standard-bio")
        .map((s) => ({ name: s.name, organizationId: s.organizationId })),
    });

    const { project: repaired, changed } = detachCompanyFromProject(
      current,
      FALSE_COMPANY_ID,
    );

    if (!changed) {
      console.log("No DorsetGM (CO-1009) link present — nothing to repair.");
      return;
    }

    await prisma.projectWorkspace.update({
      where: { id: row.id },
      data: {
        name: repaired.name,
        kind: repaired.kind,
        data: repaired as unknown as Prisma.InputJsonValue,
      },
    });

    console.log("After:", {
      linkedCompanyId: repaired.linkedCompanyId,
      relatedOrganizations: repaired.relatedOrganizations,
      externalStakeholders: (repaired.projectStakeholders ?? [])
        .filter((s) => s.organizationId !== "org-internal-standard-bio")
        .map((s) => ({ name: s.name, organizationId: s.organizationId })),
    });
    console.log("Repaired: detached CO-1009 from Carbon Emergente.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
