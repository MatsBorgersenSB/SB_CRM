import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  personEmail,
  personMatchesColleague,
  withPersonEmail,
} from "./colleague-identity";

describe("personMatchesColleague", () => {
  it("matches by email before title", () => {
    assert.equal(
      personMatchesColleague(
        { Id: 999, Title: "Wrong Name", Email: "okr@standard.bio" },
        { id: 102, title: "Ola Kjelsoas Rogndokken", email: "okr@standard.bio" },
      ),
      true,
    );
  });

  it("matches by id when email missing", () => {
    assert.equal(
      personMatchesColleague(
        { Id: 101, Title: "Hugo Jansson" },
        { id: 101, title: "Hugo", email: null },
      ),
      true,
    );
  });

  it("falls back to title", () => {
    assert.equal(
      personMatchesColleague(
        { Id: 0, Title: "Walter Aker" },
        { id: null, title: "Walter Aker", email: null },
      ),
      true,
    );
  });
});

describe("personEmail", () => {
  it("uses canonical directory by id", () => {
    assert.equal(personEmail({ Id: 102, Title: "Ola" }), "okr@standard.bio");
  });

  it("prefers explicit Email", () => {
    assert.equal(
      personEmail({ Id: 102, Title: "Ola", Email: "custom@standard.bio" }),
      "custom@standard.bio",
    );
  });
});

describe("withPersonEmail", () => {
  it("attaches canonical email", () => {
    assert.deepEqual(withPersonEmail({ Id: 101, Title: "Hugo Jansson" }), {
      Id: 101,
      Title: "Hugo Jansson",
      Email: "hugo.jansson@standard.bio",
    });
  });
});
