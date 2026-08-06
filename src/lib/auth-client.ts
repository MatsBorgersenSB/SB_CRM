/**
 * Start Azure AD sign-in via native form POST.
 * Avoids next-auth/react signIn() which calls res.json() on redirect responses
 * and throws: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
 */
export async function startAzureAdSignIn(callbackUrl = "/"): Promise<void> {
  const csrfRes = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const text = await csrfRes.text();
  if (!csrfRes.ok || text.trimStart().startsWith("<")) {
    throw new Error(`CSRF endpoint returned non-JSON (HTTP ${csrfRes.status})`);
  }
  const { csrfToken } = JSON.parse(text) as { csrfToken?: string };
  if (!csrfToken) throw new Error("Missing csrfToken");

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/auth/signin/azure-ad";
  form.style.display = "none";

  const csrfInput = document.createElement("input");
  csrfInput.name = "csrfToken";
  csrfInput.value = csrfToken;
  form.appendChild(csrfInput);

  const callbackInput = document.createElement("input");
  callbackInput.name = "callbackUrl";
  callbackInput.value = callbackUrl;
  form.appendChild(callbackInput);

  document.body.appendChild(form);
  form.submit();
}
