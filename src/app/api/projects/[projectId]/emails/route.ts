import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import {
  buildEmailThreadSummary,
  purgeEmailFromProject,
  readEmailsForProject,
} from "@/lib/email-intelligence-data";
import { readProjectById } from "@/lib/project-db";

/**
 * Project-lens Outlook mail (threads linked via projectId).
 * GET /api/projects/[projectId]/emails
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const project = await readProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        {
          error: "Project not found",
          projectId,
          emails: [],
          threads: [],
        },
        { status: 404 },
      );
    }

    const emails = await readEmailsForProject(project.id);
    const byConversation = new Map<string, typeof emails>();
    for (const email of emails) {
      const list = byConversation.get(email.conversationId) ?? [];
      list.push(email);
      byConversation.set(email.conversationId, list);
    }

    const threads = [...byConversation.entries()]
      .map(([conversationId, messages]) => ({
        conversationId,
        summary: buildEmailThreadSummary(messages),
        messages,
      }))
      .sort((a, b) => {
        const aTime = a.summary?.latestSentAt ?? a.messages.at(-1)?.sentAt ?? "";
        const bTime = b.summary?.latestSentAt ?? b.messages.at(-1)?.sentAt ?? "";
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      emails,
      threads,
    });
  } catch (error) {
    console.error("[project emails GET]", error);
    return NextResponse.json(
      {
        error: "Failed to load emails",
        detail: error instanceof Error ? error.message : "Unknown error",
        emails: [],
        threads: [],
      },
      { status: 500 },
    );
  }
}

/**
 * Purge an email from SmartCRM (project lens).
 * Body: { emailId: string }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const role = await resolveRequestRole(request);

  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      emailId?: string;
    };
    const emailId = body.emailId?.trim();
    if (!emailId) {
      return NextResponse.json({ error: "emailId is required" }, { status: 400 });
    }

    const project = await readProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const purged = await purgeEmailFromProject(project.id, emailId);
    if (!purged) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, purgedId: emailId });
  } catch (error) {
    console.error("[project emails DELETE]", error);
    return NextResponse.json(
      {
        error: "Failed to purge email",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
