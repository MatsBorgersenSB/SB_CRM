import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountOwnerChanged,
  authUserToAccountOwner,
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
