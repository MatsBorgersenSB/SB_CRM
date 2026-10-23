import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mailboxHostUsesRestItemIds,
  outlookSelectionFingerprint,
} from "./outlook-selection";

describe("outlookSelectionFingerprint", () => {
  it("changes when another mail is checked and the open item is gone", () => {
    const one = outlookSelectionFingerprint(null, null, ["a"]);
    const three = outlookSelectionFingerprint(null, null, ["a", "b", "c"]);
    assert.notEqual(one, three);
  });

  it("ignores order and blanks", () => {
    assert.equal(
      outlookSelectionFingerprint("open", "conv", ["b", "a", ""]),
      outlookSelectionFingerprint("open", "conv", ["a", "b"]),
    );
  });
});

describe("mailboxHostUsesRestItemIds", () => {
  it("keeps new Outlook and web ids as returned", () => {
    assert.equal(mailboxHostUsesRestItemIds("newOutlookWindows"), true);
    assert.equal(mailboxHostUsesRestItemIds("OutlookWebApp"), true);
    assert.equal(mailboxHostUsesRestItemIds("Outlook"), false);
  });
});
