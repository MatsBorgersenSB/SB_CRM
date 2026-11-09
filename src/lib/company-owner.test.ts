import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountOwnerChanged,
  authUserToAccountOwner,
  enrichOwnerFromDirectory,
  matchColleagueOwner,
  ownerIdFromPerson,
  personFromStoredOwnerId,
  resolveAccountOwner,
} from "./company-owner";
import type { AuthUser } from "@/types/auth";

function user(partial: Partial<AuthUser>): AuthUser {
  return {
    id: 0,
    displayName: "Guest",
    role: "commercial",
    ...partial,
  };
}

describe("authUserToAccountOwner", () => {
  it("maps the registrar by email even when the session id is a placeholder", () => {
    const owner = authUserToAccountOwner(
      user({
        id: 1,
        displayName: "Walter Aker",
        email: "walter.aker@standard.bio",
      }),
    );
    assert.equal(owner.Id, 100);
    assert.equal(owner.Title, "Walter Aker");
  });

  it("maps the registrar by display name", () => {
    const owner = authUserToAccountOwner(
      user({ id: 1, displayName: "Hugo Jansson", email: "hugo.jansson@standard.bio" }),
    );
    assert.equal(owner.Id, 101);
    assert.equal(owner.Title, "Hugo Jansson");
  });

  it("maps short colleague emails like okr@standard.bio even without matching display name", () => {
    const owner = authUserToAccountOwner(
      user({ id: 1, displayName: "Ola", email: "okr@standard.bio" }),
    );
    assert.equal(owner.Id, 102);
    assert.equal(owner.Title, "Ola Kjelsoas Rogndokken");
  });

  it("does not assign Mats when SSO placeholder id 1 belongs to someone else", () => {
    const owner = authUserToAccountOwner(
      user({
        id: 1,
        displayName: "Ada Lovelace",
        email: "ada@standard.bio",
      }),
    );
    assert.notEqual(owner.Title, "Mats Borgersen");
    assert.notEqual(owner.Id, 1);
    assert.equal(owner.Title, "Ada Lovelace");
  });
});

describe("resolveAccountOwner", () => {
  it("keeps an explicit owner when the registrar picks a colleague", () => {
    const owner = resolveAccountOwner(
      { Id: 102, Title: "Ola Kjelsoas Rogndokken" },
      user({ displayName: "Mats Borgersen", email: "mats.borgersen@standard.bio", id: 1 }),
    );
    assert.equal(owner.Id, 102);
  });

  it("defaults to the signed-in registrar when none is chosen", () => {
    const owner = resolveAccountOwner(
      null,
      user({ displayName: "Bjørn Molskred", email: "bjorn.molskred@standard.bio" }),
    );
    assert.equal(owner.Id, 103);
    assert.equal(owner.Title, "Bjørn Molskred");
  });

  it("does not invent Mats when no registrar is known", () => {
    const owner = resolveAccountOwner(null);
    assert.notEqual(owner?.Title, "Mats Borgersen");
    assert.equal(owner, null);
  });
});

describe("ownerIdFromPerson", () => {
  it("stores a colleague id and clears when ownership is removed", () => {
    assert.equal(ownerIdFromPerson({ Id: 101, Title: "Hugo Jansson" }), "101");
    assert.equal(ownerIdFromPerson(null), null);
  });

  it("persists the new owner id when responsibility is reassigned", () => {
    const previous = ownerIdFromPerson({ Id: 1, Title: "Mats Borgersen" });
    const next = ownerIdFromPerson({ Id: 101, Title: "Hugo Jansson" });
    assert.equal(previous, "1");
    assert.equal(next, "101");
    assert.notEqual(previous, next);
  });
});

describe("matchColleagueOwner", () => {
  const directory = [
    { id: 1, email: "mats.borgersen@standard.bio", displayName: "Mats Borgersen" },
    { id: 104, email: "ada@standard.bio", displayName: "Ada Lovelace" },
  ];

  it("resolves the importer by email before placeholder id 1", () => {
    const owner = matchColleagueOwner(
      { email: "ada@standard.bio", displayName: "Ada", id: 1 },
      directory,
    );
    assert.equal(owner?.Id, 104);
    assert.equal(owner?.Title, "Ada Lovelace");
  });
});

describe("personFromStoredOwnerId", () => {
  it("keeps a reassigned Users & Access owner instead of dropping them", () => {
    const owner = personFromStoredOwnerId("104");
    assert.equal(owner?.Id, 104);
  });

  it("fills the colleague name after owner is changed", () => {
    const stored = personFromStoredOwnerId("104");
    const enriched = enrichOwnerFromDirectory(stored, [
      { id: 104, email: "ada@standard.bio", displayName: "Ada Lovelace" },
    ]);
    assert.equal(enriched?.Id, 104);
    assert.equal(enriched?.Title, "Ada Lovelace");
  });
});

describe("accountOwnerChanged", () => {
  it("is true when ownership moves to another colleague", () => {
    assert.equal(
      accountOwnerChanged(
        { Id: 1, Title: "Mats Borgersen" },
        { Id: 100, Title: "Walter Aker" },
      ),
      true,
    );
  });

  it("is false when the same owner is saved again", () => {
    assert.equal(
      accountOwnerChanged(
        { Id: 1, Title: "Mats Borgersen" },
        { Id: 1, Title: "Mats Borgersen" },
      ),
      false,
    );
  });
});
