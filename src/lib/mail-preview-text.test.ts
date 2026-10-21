import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readableMailText } from "./mail-preview-text";

describe("readable mail text", () => {
  it("keeps the reply and drops the signature and the quoted mail", () => {
    const raw = [
      "Hei Peter, takk for din forespørsel! Har du noen ide om hvilken kvalitet og hvilke mengder du har behov for. Vi kan levere i bigbag 1m3 NOK 4000,-",
      " Best RegardsMats A. BorgersenSales & Business Development This email, including any attachments, is confidential and intended solely for the use of the individual.",
      " Sent: Tuesday, October 20, 2026 17:02 To: Mats Borgersen Subject: Biokull Hei, Vi tror at vi kan få nytte av biokull.",
    ].join("");

    assert.equal(
      readableMailText(raw),
      "Hei Peter, takk for din forespørsel! Har du noen ide om hvilken kvalitet og hvilke mengder du har behov for. Vi kan levere i bigbag 1m3 NOK 4000,-",
    );
  });

  it("keeps Peter's request and drops the sign-off", () => {
    const raw =
      "Hei, Vi tror at vi kan få nytte av biokull i vår planteproduksjon og til jordforbedring. Mvh, Peter Sendt fra min Galaxy";
    assert.equal(
      readableMailText(raw),
      "Hei, Vi tror at vi kan få nytte av biokull i vår planteproduksjon og til jordforbedring.",
    );
  });
});
