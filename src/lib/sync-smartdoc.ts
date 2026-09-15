import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";

export async function deleteSmartDocRecord(
  documentId: string,
  role: UserRole,
): Promise<void> {
  const response = await fetch(
    `/api/smartdocs/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
      headers: { [AUTH_ROLE_HEADER]: role },
    },
  );

  if (response.ok || response.status === 204) return;

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error?.trim() || "Unable to delete this document.");
}
