/**
 * Start Azure AD sign-in by navigating to the server start route.
 * Avoids next-auth/react signIn() JSON/HTML parse failures.
 */
export function startAzureAdSignIn(callbackUrl = "/"): void {
  const params = new URLSearchParams({ callbackUrl });
  window.location.assign(`/api/azure-start?${params.toString()}`);
}
