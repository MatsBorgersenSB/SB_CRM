import { inngest } from "./client";

/**
 * Starter durable function. Side-effect free (no DB / M365 calls) so it is safe
 * to deploy. Trigger from the Inngest dev UI with event `crm/healthcheck.requested`.
 *
 * Migration pattern for heavy work (M365 mail sync, tender ingest):
 *   1. Define a new event, e.g. `m365/mail.sync.requested`.
 *   2. Add a function below; wrap each unit of work in `step.run(...)` so it is
 *      retried and memoized independently.
 *   3. Have the existing route/cron `inngest.send(...)` the event instead of
 *      doing the work inline.
 */
export const crmBackgroundHealthcheck = inngest.createFunction(
  {
    id: "crm-background-healthcheck",
    triggers: [{ event: "crm/healthcheck.requested" }],
  },
  async ({ event, step }) => {
    const startedAt = await step.run("record-start", () => new Date().toISOString());

    await step.sleep("settle", "1s");

    const finishedAt = await step.run("record-finish", () => new Date().toISOString());

    return {
      ok: true,
      eventId: event.id ?? null,
      startedAt,
      finishedAt,
    };
  },
);

export const functions = [crmBackgroundHealthcheck];
