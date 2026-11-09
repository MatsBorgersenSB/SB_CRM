import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  m365ComposeHref,
  outlookComposeHref,
  outlookWebComposeHref,
} from "./compose-actions";
import { outlookComposeUrl } from "./outlook-compose-link";

describe("outlook compose links", () => {
  it("opens a desktop new message instead of the inbox deeplink", () => {
    assert.equal(outlookComposeHref("bjorn@example.no"), "mailto:bjorn@example.no");
    assert.equal(
      outlookComposeHref("bjorn@example.no", "Hello there"),
      "mailto:bjorn@example.no?subject=Hello%20there",
    );
    assert.equal(outlookComposeUrl(), "mailto:");
    assert.equal(
      outlookComposeUrl({ to: "bjorn@example.no", subject: "Re: Visit" }),
      "mailto:bjorn@example.no?subject=Re%3A%20Visit",
    );
  });

  it("keeps Microsoft 365 compose on the web pop-out route", () => {
    const href = m365ComposeHref("bjorn@example.no", "Hello");
    assert.equal(
      href,
      outlookWebComposeHref("bjorn@example.no", "Hello"),
    );
    assert.match(href, /^https:\/\/outlook\.office\.com\/mail\/deeplink\/compose\/\?/);
    assert.match(href, /to=bjorn%40example\.no/);
    assert.match(href, /popoutv2=1/);
  });
});
