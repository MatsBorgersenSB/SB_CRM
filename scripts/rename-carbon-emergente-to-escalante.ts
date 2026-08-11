/**
 * Rename project Carbon Emergente → Escalante and propagate to email links + Outlook tags.
 *
 * Usage: npx tsx scripts/rename-carbon-emergente-to-escalante.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { readProjectById, updateProject } = await import("../src/lib/project-db");
  const { getPrisma } = await import("../src/lib/prisma");

  const projectId = "PRJ-CARBON-EMERGENTE";
  const nextName = "Escalante";

  const before = await readProjectById(projectId);
  if (!before) {
    throw new Error(`Project not found: ${projectId}`);
  }

  console.log(`Renaming "${before.name}" → "${nextName}" (${projectId})`);
  const updated = await updateProject(projectId, { name: nextName });

  const prisma = getPrisma();
  const linked = await prisma.emailMessageRecord.count({
    where: { projectId, projectName: nextName },
  });
  const stillOld = await prisma.emailMessageRecord.count({
    where: {
      OR: [{ projectName: "Carbon Emergente" }, { projectName: { contains: "Carbon Emergente" } }],
    },
  });

  console.log("Project name now:", updated.name);
  console.log("Email records with Escalante:", linked);
  console.log("Email records still mentioning Carbon Emergente:", stillOld);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    const { getPrisma } = await import("../src/lib/prisma");
    await getPrisma().$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
