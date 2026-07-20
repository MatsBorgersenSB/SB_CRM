import { buildM365DailyFocus, loadM365DataContext } from "@/lib/m365";
import { m365Error, m365Json } from "@/lib/m365/api-response";

export async function GET() {
  try {
    const ctx = await loadM365DataContext();
    return m365Json(buildM365DailyFocus(ctx));
  } catch {
    return m365Error("Failed to build daily focus intelligence", 500);
  }
}
