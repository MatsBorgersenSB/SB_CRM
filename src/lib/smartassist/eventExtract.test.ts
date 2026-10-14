import assert from "node:assert/strict";
import test from "node:test";
import {
  findContinueTarget,
  mergeProposal,
  normalizeEventUrl,
  parseEventDates,
  parseEventLocation,
  proposeEventFromText,
  publicEventUrl,
  readHtmlTitle,
} from "./eventExtract";

test("parses a day-first range with a single month", () => {
  assert.deepEqual(parseEventDates("1 - 3 December 2026 | Tokyo, Japan"), {
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
});

test("parses a range that crosses months", () => {
  assert.deepEqual(parseEventDates("30 Nov – 2 Dec 2026"), {
    startDate: "2026-11-30",
    endDate: "2026-12-02",
  });
});

test("parses a month-first range and a single date", () => {
  assert.deepEqual(parseEventDates("December 1-3, 2026"), {
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  assert.deepEqual(parseEventDates("Seminar on 3 December 2026 in Oslo"), {
    startDate: "2026-12-03",
    endDate: "2026-12-03",
  });
});

test("returns null when no date exists instead of guessing", () => {
  assert.equal(parseEventDates("Join us at the annual carbon forum"), null);
});

test("reads a city and country after the date", () => {
  assert.equal(parseEventLocation("1 - 3 December 2026 | Tokyo, Japan"), "Tokyo, Japan");
  assert.equal(parseEventLocation("01-03 Dec, 2026 Tokyo, JAPAN Tokyo Marriott Hotel"), "Tokyo, Japan");
  assert.equal(parseEventLocation("12 May 2027 | London, United Kingdom Agenda"), "London, United Kingdom");
});

test("cleans SEO filler and repeated words out of page titles", () => {
  const html = `<title>DeCarbon Tokyo 2026 Tokyo Event | Conference | Summit Schedule</title>`;
  const proposal = proposeEventFromText({ text: "x", html });
  assert.equal(proposal.title, "DeCarbon Tokyo 2026");
});

test("prefers og:title and trims site suffixes", () => {
  const html = `<html><head><title>DeCarbon Tokyo 2026 | CMT Events</title><meta property="og:title" content="DeCarbon Tokyo 2026"></head></html>`;
  assert.equal(readHtmlTitle(html), "DeCarbon Tokyo 2026");
});

test("deterministic proposal never invents organizer or themes", () => {
  const proposal = proposeEventFromText({
    text: "DeCarbon Tokyo 2026\n1 - 3 December 2026 | Tokyo, Japan\nFrom Reduction, Regulation to Removal",
    sourceUrl: "https://www.cmtevents.com/main1.aspx?ev=261210",
  });
  assert.equal(proposal.title, "DeCarbon Tokyo 2026");
  assert.equal(proposal.startDate, "2026-12-01");
  assert.equal(proposal.endDate, "2026-12-03");
  assert.equal(proposal.location, "Tokyo, Japan");
  assert.equal(proposal.organizer, null);
  assert.deepEqual(proposal.themes, []);
  assert.deepEqual(proposal.found, { title: true, dates: true, location: true });
});

test("merge keeps parsed dates over the model and accepts themes", () => {
  const base = proposeEventFromText({ text: "DeCarbon Tokyo 2026\n1 - 3 December 2026 | Tokyo, Japan" });
  const merged = mergeProposal(base, {
    startDate: "2026-12-05",
    organizer: "Centre for Management Technology",
    themes: ["CCUS", "Carbon markets", "", 42],
    summary: "Japan's carbon transition conference.",
  });
  assert.equal(merged.startDate, "2026-12-01");
  assert.equal(merged.organizer, "Centre for Management Technology");
  assert.deepEqual(merged.themes, ["CCUS", "Carbon markets"]);
  assert.equal(merged.summary, "Japan's carbon transition conference.");
});

test("follows a thin continue gate one hop on the same origin", () => {
  const gate = `<html><title>CMT Events</title><body><a href="UnSubscribe.aspx">Unsubscribe</a>
    <a href="main.aspx?ev=261210&st=54&pg=sc&ver=conf">Click here to Continue ›</a></body></html>`;
  assert.equal(
    findContinueTarget(gate, "https://www.cmtevents.com/main1.aspx?ev=261210&st=54&pg=sc"),
    "https://www.cmtevents.com/main.aspx?ev=261210&st=54&pg=sc&ver=conf",
  );
  const rich = `<html><body>${"Agenda detail. ".repeat(80)}<a href="/x">Continue</a></body></html>`;
  assert.equal(findContinueTarget(rich, "https://example.com/event"), null);
  const offsite = `<html><body><a href="https://evil.example/go">Continue</a></body></html>`;
  assert.equal(findContinueTarget(offsite, "https://example.com/event"), null);
});

test("strips recipient and campaign tracking from the saved link", () => {
  assert.equal(
    publicEventUrl("https://www.cmtevents.com/main.aspx?ev=261210&st=54&pg=sc&eid=148268536&em=mireen%40standard.bio&&ver=conf"),
    "https://www.cmtevents.com/main.aspx?ev=261210&st=54&pg=sc&ver=conf",
  );
  assert.equal(publicEventUrl("https://x.com/e?utm_source=mail#top"), "https://x.com/e");
});

test("normalizes urls and rejects junk", () => {
  assert.equal(normalizeEventUrl("cmtevents.com/main1.aspx?ev=1"), "https://cmtevents.com/main1.aspx?ev=1");
  assert.equal(normalizeEventUrl("not a url"), null);
  assert.equal(normalizeEventUrl(""), null);
});
