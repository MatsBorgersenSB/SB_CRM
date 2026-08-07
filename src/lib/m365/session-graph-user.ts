import { auth } from "@/lib/auth";

/**
 * Resolve the signed-in user's Entra object id for Graph token binding.
 */
export async function getSessionAzureOid(): Promise<string | undefined> {
  const session = await auth();
  const oid = session?.azureOid?.trim();
  return oid || undefined;
}
