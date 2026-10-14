import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GRAPH_SEARCH_SNIPPET_LIMIT,
  mapGraphSearchResponse,
  mockGraphSearchResults,
  searchInternalContext,
  stripHtml,
  truncateSnippet,
} from "./graphSearch";

describe("graph search mapping", () => {
  it("returns an empty list when Graph has no hits", () => {
    assert.deepEqual(mapGraphSearchResponse({ value: [{ hitsContainers: [{ hits: [] }] }] }), []);
    assert.deepEqual(mapGraphSearchResponse({}), []);
    assert.deepEqual(mapGraphSearchResponse(null), []);
  });

  it("maps mail, files, and chats and strips HTML from the snippet", () => {
    const items = mapGraphSearchResponse({
      value: [
        {
          hitsContainers: [
            {
              hits: [
                {
                  hitId: "mail-1",
                  summary: "<b>Sludge</b> volumes &amp; next step",
                  resource: {
                    "@odata.type": "#microsoft.graph.message",
                    subject: "Feedstock trial",
                    receivedDateTime: "2026-10-12T09:15:00Z",
                    webLink: "https://outlook.office.com/mail/id/mail-1",
                  },
                },
                {
                  hitId: "file-1",
                  resource: {
                    "@odata.type": "#microsoft.graph.driveItem",
                    name: "Site assessment.pdf",
                    lastModifiedDateTime: "2026-10-08T14:40:00.000Z",
                    webUrl: "https://contoso.sharepoint.com/sites/projects/site-assessment.pdf",
                  },
                },
                {
                  hitId: "chat-1",
                  summary: "Can we move the site visit?",
                  resource: {
                    "@odata.type": "#microsoft.graph.chatMessage",
                    createdDateTime: "2026-10-11T16:00:00Z",
                    body: { content: "<p>Ignore this HTML</p>" },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    assert.equal(items.length, 3);
    assert.equal(items[0]?.sourceType, "OUTLOOK");
    assert.equal(items[0]?.title, "Feedstock trial");
    assert.equal(items[0]?.snippet, "Sludge volumes & next step");
    assert.equal(items[1]?.sourceType, "ONEDRIVE");
    assert.equal(items[1]?.title, "Site assessment.pdf");
    assert.equal(items[2]?.sourceType, "TEAMS");
    assert.equal(items[2]?.webUrl, "");
  });

  it("truncates snippets to 300 characters", () => {
    const long = `<p>${"a".repeat(500)}</p>`;
    const stripped = stripHtml(long);
    assert.equal(stripped.length, 500);
    const truncated = truncateSnippet(long);
    assert.equal(truncated.length, GRAPH_SEARCH_SNIPPET_LIMIT);
  });

  it("returns an empty list instead of throwing when the token is missing", async () => {
    const items = await searchInternalContext("feedstock", "  ");
    assert.deepEqual(items, []);
  });

  it("mock results are one Outlook message and one SharePoint file", () => {
    const items = mockGraphSearchResults(new Date("2026-10-14T08:00:00.000Z"));
    assert.equal(items.length, 2);
    assert.equal(items[0]?.sourceType, "OUTLOOK");
    assert.equal(items[1]?.sourceType, "ONEDRIVE");
    assert.match(items[1]?.title ?? "", /\.pdf$/i);
    assert.match(items[1]?.webUrl ?? "", /sharepoint\.com/i);
    assert.ok(items.every((item) => !Number.isNaN(Date.parse(item.timestamp))));
    assert.ok(items.every((item) => item.snippet.length <= GRAPH_SEARCH_SNIPPET_LIMIT));
  });
});
