import "server-only";

import {
  fetchGraphMe,
  getActiveM365AccessToken,
  graphRequest,
} from "@/lib/m365-client";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";

const GRAPH_USER = "https://graph.microsoft.com/v1.0/users";

type ChatCreated = { id?: string };

/**
 * Tell a colleague they were assigned work.
 * Teams 1:1 first (where they already collaborate). Outlook mail if Teams cannot send.
 */
export async function pingColleagueAboutAssignment(input: {
  assigneeEmail: string;
  html: string;
  mailSubject: string;
}): Promise<"teams" | "mail" | null> {
  const email = input.assigneeEmail.trim().toLowerCase();
  if (!email.includes("@")) return null;

  const oid = await getSessionAzureOid().catch(() => undefined);
  const token = await getActiveM365AccessToken(oid);
  if (!token?.accessToken) {
    console.warn("[assignment-notify] No M365 token — colleague was not pinged outside SmartCRM");
    return null;
  }

  const teams = await sendTeamsChat(token.accessToken, email, input.html);
  if (teams) return "teams";

  const mail = await sendOutlookMail(token.accessToken, email, input.mailSubject, input.html);
  return mail ? "mail" : null;
}

async function sendTeamsChat(
  accessToken: string,
  assigneeEmail: string,
  html: string,
): Promise<boolean> {
  try {
    const me = await fetchGraphMe(accessToken);
    const assigner = (me.userPrincipalName || me.mail || "").trim();
    if (!assigner) return false;

    const chat = await graphRequest<ChatCreated>(accessToken, "/me/chats", {
      method: "POST",
      body: JSON.stringify({
        chatType: "oneOnOne",
        members: [
          aadChatMember(assigner),
          aadChatMember(assigneeEmail),
        ],
      }),
    });
    if (!chat?.id) return false;

    await graphRequest(accessToken, `/chats/${encodeURIComponent(chat.id)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: { contentType: "html", content: html },
      }),
    });
    return true;
  } catch (error) {
    console.warn(
      "[assignment-notify] Teams ping failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

async function sendOutlookMail(
  accessToken: string,
  assigneeEmail: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    await graphRequest(accessToken, "/me/sendMail", {
      method: "POST",
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: assigneeEmail } }],
        },
        saveToSentItems: true,
      }),
    });
    return true;
  } catch (error) {
    console.warn(
      "[assignment-notify] Outlook ping failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

function aadChatMember(userPrincipalName: string) {
  const upn = userPrincipalName.replace(/'/g, "");
  return {
    "@odata.type": "#microsoft.graph.aadUserConversationMember",
    roles: ["owner"],
    "kevin.m@example.com": `${GRAPH_USER}('${upn}')`,
  };
}
