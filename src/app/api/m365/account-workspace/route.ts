import { buildM365AccountWorkspace } from "@/lib/m365";
import { m365Error, m365Json } from "@/lib/m365/api-response";
import { loadM365PaneContext } from "@/lib/m365/pane-context";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const email = searchParams.get("email");

  if (!companyId && !email) {
    return m365Error("Provide companyId or email query parameter", 400);
  }

  try {
    const { ctx, resolved } = await loadM365PaneContext({ email, companyId });

    if (!resolved) {
      return m365Error("No matching account found for this context", 404);
    }

    return m365Json(buildM365AccountWorkspace(resolved.company, ctx));
  } catch {
    return m365Error("Failed to build account workspace intelligence", 500);
  }
}
