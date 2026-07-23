"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { useAuth } from "@/context/auth-context";
import { isManagerOrAbove, toEnterpriseRole } from "@/lib/security/rbac";
import type { WebhookPlatform } from "@/lib/notifications/webhook-service";

const STORAGE_KEY = "smartcrm.fs015.webhookChannels";

type ChannelConfig = {
  slackUrl: string;
  teamsUrl: string;
};

function loadConfig(): ChannelConfig {
  if (typeof window === "undefined") {
    return { slackUrl: "", teamsUrl: "" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { slackUrl: "", teamsUrl: "" };
    const parsed = JSON.parse(raw) as Partial<ChannelConfig>;
    return {
      slackUrl: typeof parsed.slackUrl === "string" ? parsed.slackUrl : "",
      teamsUrl: typeof parsed.teamsUrl === "string" ? parsed.teamsUrl : "",
    };
  } catch {
    return { slackUrl: "", teamsUrl: "" };
  }
}

/**
 * FS-015 — Slack / Teams webhook channel configuration (admin workspace).
 */
export function WebhookChannelConfigCard() {
  const { user } = useAuth();
  const allowed = isManagerOrAbove(user);
  const [config, setConfig] = useState<ChannelConfig>({ slackUrl: "", teamsUrl: "" });
  const [busy, setBusy] = useState<WebhookPlatform | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const persist = useCallback((next: ChannelConfig) => {
    setConfig(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const testWebhook = useCallback(
    async (platform: WebhookPlatform) => {
      if (!allowed) {
        setError("ADMIN or MANAGER required to test webhooks.");
        return;
      }
      const webhookUrl = platform === "SLACK" ? config.slackUrl : config.teamsUrl;
      if (!webhookUrl.trim()) {
        setError(`Add a ${platform} webhook URL first.`);
        return;
      }

      setBusy(platform);
      setError(null);
      setMessage(null);
      try {
        const response = await fetch("/api/notifications/webhook-test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: user.role,
            "x-sb-user-id": String(user.id),
            "x-sb-user-name": user.displayName,
          },
          body: JSON.stringify({
            platform,
            webhookUrl,
            event: "WEBHOOK_TEST",
            payload: {
              title: `SmartCRM ${platform} test`,
              message: `Test alert from ${user.displayName} (${toEnterpriseRole(user.role)}).`,
            },
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          result?: { detail?: string };
        };
        if (!response.ok || payload.success === false) {
          throw new Error(
            payload.error || payload.result?.detail || "Webhook dispatch failed",
          );
        }
        setMessage(`${platform} webhook accepted.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Test failed");
      } finally {
        setBusy(null);
      }
    },
    [allowed, config.slackUrl, config.teamsUrl, user],
  );

  if (!allowed) {
    return (
      <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3 text-sm text-carbon-blue/55">
        Webhook channel configuration is available to ADMIN and MANAGER roles.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-carbon-blue/55">
        Connect Slack or Microsoft Teams incoming webhooks for deal wins, approvals, and
        alert fan-out. URLs stay in this browser; tests are audited as{" "}
        <span className="font-medium text-carbon-blue">WEBHOOK_DISPATCHED</span>.
      </p>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Slack webhook URL
        </span>
        <input
          type="url"
          value={config.slackUrl}
          onChange={(event) =>
            persist({ ...config, slackUrl: event.target.value })
          }
          placeholder="https://hooks.slack.com/services/…"
          className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
        />
        <button
          type="button"
          disabled={busy === "SLACK"}
          onClick={() => void testWebhook("SLACK")}
          className="mt-2 border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue hover:border-upcycle-orange/40 hover:text-upcycle-orange disabled:opacity-50"
        >
          {busy === "SLACK" ? "Sending…" : "Send Slack test"}
        </button>
      </label>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Teams webhook URL
        </span>
        <input
          type="url"
          value={config.teamsUrl}
          onChange={(event) =>
            persist({ ...config, teamsUrl: event.target.value })
          }
          placeholder="https://outlook.office.com/webhook/…"
          className="mt-1 w-full border border-carbon-blue/15 px-2 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
        />
        <button
          type="button"
          disabled={busy === "TEAMS"}
          onClick={() => void testWebhook("TEAMS")}
          className="mt-2 border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue hover:border-upcycle-orange/40 hover:text-upcycle-orange disabled:opacity-50"
        >
          {busy === "TEAMS" ? "Sending…" : "Send Teams test"}
        </button>
      </label>

      {message ? <p className="text-[12px] text-emerald-700">{message}</p> : null}
      {error ? <p className="text-[12px] text-thermal-red">{error}</p> : null}
    </div>
  );
}
