import "server-only";

import {
  getActiveM365AccessToken,
  graphRequest,
} from "@/lib/m365-client";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";

type TodoList = { id?: string; displayName?: string; wellknownListName?: string };
type TodoTask = { id?: string; title?: string; webUrl?: string };

/**
 * Create a Microsoft To Do task (surfaces in Planner / tasks.office.com for the user).
 * Returns the task web URL when Graph succeeds.
 */
export async function createPlannerEligibleTask(input: {
  title: string;
  body?: string;
  dueDate?: string | null;
  openUrl?: string | null;
}): Promise<{ taskId: string; webUrl: string | null } | null> {
  const title = input.title.trim();
  if (!title) return null;

  const oid = await getSessionAzureOid().catch(() => undefined);
  const token =
    (await getActiveM365AccessToken(oid)) ??
    (oid ? await getActiveM365AccessToken() : null);
  if (!token?.accessToken) {
    console.warn("[planner-create] No M365 token — task not created");
    return null;
  }

  const listId = await resolveDefaultTodoListId(token.accessToken);
  if (!listId) return null;

  const due = normalizeDue(input.dueDate);
  const bodyParts = [input.body?.trim(), input.openUrl?.trim()].filter(Boolean);

  try {
    const created = await graphRequest<TodoTask>(
      token.accessToken,
      `/me/todo/lists/${encodeURIComponent(listId)}/tasks`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          body: bodyParts.length
            ? {
                content: bodyParts.join("\n\n"),
                contentType: "text",
              }
            : undefined,
          dueDateTime: due
            ? { dateTime: `${due}T17:00:00.0000000`, timeZone: "UTC" }
            : undefined,
        }),
      },
    );
    if (!created?.id) return null;

    if (input.openUrl?.trim()) {
      try {
        await graphRequest(
          token.accessToken,
          `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(created.id)}/linkedResources`,
          {
            method: "POST",
            body: JSON.stringify({
              webUrl: input.openUrl.trim(),
              applicationName: "SmartCRM",
              displayName: "Open in SmartCRM",
            }),
          },
        );
      } catch {
        /* linked resource optional */
      }
    }

    return {
      taskId: created.id,
      webUrl: created.webUrl?.trim() || "https://tasks.office.com/",
    };
  } catch (error) {
    console.warn(
      "[planner-create] Graph create failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function resolveDefaultTodoListId(accessToken: string): Promise<string | null> {
  try {
    const payload = await graphRequest<{ value?: TodoList[] }>(
      accessToken,
      "/me/todo/lists?$top=50",
    );
    const lists = payload.value ?? [];
    const defaultList =
      lists.find((list) => list.wellknownListName === "defaultList") ||
      lists.find((list) => /tasks/i.test(list.displayName ?? "")) ||
      lists[0];
    return defaultList?.id?.trim() || null;
  } catch (error) {
    console.warn(
      "[planner-create] list lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function normalizeDue(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}
