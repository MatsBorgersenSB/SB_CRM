import { Inngest } from "inngest";

/**
 * Shared Inngest client for SmartCRM background work.
 * Served at `/api/inngest` (see `src/app/api/inngest/route.ts`).
 * Local dev: `npx inngest-cli@latest dev`.
 */
export const inngest = new Inngest({ id: "sb-crm" });
