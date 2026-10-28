import { redirect } from "next/navigation";
import { MailShell, type MailLinkOption } from "@/components/layout/mail-shell";
import { auth } from "@/lib/auth";
import { prismaLiveOpportunityWhere } from "@/lib/demo-seed-markers";
import { readRecentLinkedEmails } from "@/lib/email-intelligence-data";
import { canAccessRoute } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { readProjects } from "@/lib/project-db";
import { sessionToAuthUser } from "@/lib/session-user";
import { readAssignableStandardBioUsers } from "@/lib/standard-bio-users-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Open deals and projects a conversation can be filed against. Empty on failure — never invented. */
async function readLinkOptions(): Promise<{
  opportunityOptions: MailLinkOption[];
  projectOptions: MailLinkOption[];
}> {
  const [opportunityOptions, projectOptions] = await Promise.all([
    getPrisma()
      .opportunity.findMany({
        where: { status: "open", AND: prismaLiveOpportunityWhere.AND },
        select: { id: true, name: true, code: true, companyId: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      })
      .then((rows) =>
        rows.map(
          (row): MailLinkOption => ({
            id: row.id,
            label: row.code ? `${row.code} · ${row.name}` : row.name,
            name: row.name,
            code: row.code,
            companyId: row.companyId,
          }),
        ),
      )
      .catch((): MailLinkOption[] => []),
    readProjects()
      .then((rows) =>
        rows.slice(0, 100).map(
          (row): MailLinkOption => ({
            id: row.id,
            label: row.name,
            name: row.name,
            code: null,
            companyId: null,
          }),
        ),
      )
      .catch((): MailLinkOption[] => []),
  ]);
  return { opportunityOptions, projectOptions };
}

export default async function MailPage() {
  // Server-side guard: hiding the nav item is not access control.
  const user = sessionToAuthUser(await auth().catch(() => null));
  if (!canAccessRoute(user.role, "/mail")) redirect("/");

  const [messages, linkOptions, assignableUsers] = await Promise.all([
    readRecentLinkedEmails(200),
    readLinkOptions(),
    readAssignableStandardBioUsers().catch(() => []),
  ]);
  return (
    <MailShell
      messages={messages}
      role={user.role}
      assignableUsers={assignableUsers}
      {...linkOptions}
    />
  );
}
