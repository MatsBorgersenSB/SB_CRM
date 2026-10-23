import { redirect } from "next/navigation";
import { MailShell } from "@/components/layout/mail-shell";
import { auth } from "@/lib/auth";
import { readRecentLinkedEmails } from "@/lib/email-intelligence-data";
import { canAccessRoute } from "@/lib/permissions";
import { sessionToAuthUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MailPage() {
  // Server-side guard: hiding the nav item is not access control.
  const user = sessionToAuthUser(await auth().catch(() => null));
  if (!canAccessRoute(user.role, "/mail")) redirect("/");

  const messages = await readRecentLinkedEmails(50);
  return <MailShell messages={messages} />;
}
