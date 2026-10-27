import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mailboxHostUsesRestItemIds,
  messageIdVariants,
  outlookSelectionFingerprint,
  toEwsMessageId,
  toGraphRestMessageId,
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

describe("toGraphRestMessageId", () => {
  it("converts EWS `/` and `+` into Graph REST v2.0 `-` and `_` so OData path segments do not split", () => {
    const ewsId =
      "AAMkAGI2/KJt9SYpIXXaFRwj5BwDMT+UmkxXUT7mCFMIgG+LCAAAAAAEFMAADMT+UmkxXUT7mCFMIgG+LCAAEetoTP8/AAA=";
    const restId =
      "AAMkAGI2-KJt9SYpIXXaFRwj5BwDMT_UmkxXUT7mCFMIgG_LCAAAAAAEFMAADMT_UmkxXUT7mCFMIgG_LCAAEetoTP8-AAA=";
    assert.equal(toGraphRestMessageId(ewsId), restId);
    assert.equal(toGraphRestMessageId(restId), restId);
    assert.equal(toEwsMessageId(restId), ewsId);
    assert.deepEqual(messageIdVariants(ewsId), [ewsId, restId]);
  });
});
