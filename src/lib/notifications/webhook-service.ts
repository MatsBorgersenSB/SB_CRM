export type WebhookPlatform = "SLACK" | "TEAMS";

export type WebhookDispatchResult = {
  ok: boolean;
  platform: WebhookPlatform;
  event: string;
  status: number | null;
  detail: string;
};

function buildSlackBody(event: string, payload: Record<string, unknown>): unknown {
  const title =
    typeof payload.title === "string"
      ? payload.title
      : `SmartCRM · ${event}`;
  const text =
    typeof payload.message === "string"
      ? payload.message
      : typeof payload.text === "string"
        ? payload.text
        : JSON.stringify(payload, null, 2);

  return {
    text: `*${title}*\n${text}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: title.slice(0, 150), emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: text.slice(0, 2900) },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Event: \`${event}\` · SmartCRM`,
          },
        ],
      },
    ],
  };
}

function buildTeamsBody(event: string, payload: Record<string, unknown>): unknown {
  const title =
    typeof payload.title === "string"
      ? payload.title
      : `SmartCRM · ${event}`;
  const text =
    typeof payload.message === "string"
      ? payload.message
      : typeof payload.text === "string"
        ? payload.text
        : JSON.stringify(payload, null, 2);

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: title,
    themeColor: "E87722",
    title,
    text,
    sections: [
      {
        facts: [
          { name: "Event", value: event },
          { name: "Source", value: "SmartCRM" },
        ],
      },
    ],
  };
}

/**
 * Dispatch a collaboration alert to Slack or Microsoft Teams incoming webhook.
 */
export async function sendWebhookAlert(
  platform: WebhookPlatform,
  webhookUrl: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<WebhookDispatchResult> {
  const url = webhookUrl.trim();
  if (!url.startsWith("https://")) {
    return {
      ok: false,
      platform,
      event,
      status: null,
      detail: "Webhook URL must be HTTPS",
    };
  }

  const body =
    platform === "SLACK"
      ? buildSlackBody(event, payload)
      : buildTeamsBody(event, payload);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const detail = await response.text().catch(() => "");
    return {
      ok: response.ok,
      platform,
      event,
      status: response.status,
      detail: detail.slice(0, 500) || (response.ok ? "Dispatched" : "Webhook rejected"),
    };
  } catch (error) {
    return {
      ok: false,
      platform,
      event,
      status: null,
      detail: error instanceof Error ? error.message : "Webhook request failed",
    };
  }
}
