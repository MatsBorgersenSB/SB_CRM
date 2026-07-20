/** Read a fetch Response body once, then parse JSON when possible. */
export async function readResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}
