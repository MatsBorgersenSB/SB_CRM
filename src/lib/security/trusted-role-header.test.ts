import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTH_ROLE_HEADER } from "@/types/auth";
import { applyTrustedRoleHeader } from "./trusted-role-header";

describe("applyTrustedRoleHeader", () => {
  it("discards a client-supplied role when there is no session role", () => {
    const headers = new Headers({ [AUTH_ROLE_HEADER]: "admin" });
    applyTrustedRoleHeader(headers, undefined);
    assert.equal(headers.get(AUTH_ROLE_HEADER), null);
  });

  it("overwrites a spoofed role with the session role", () => {
    const headers = new Headers({ [AUTH_ROLE_HEADER]: "superuser" });
    applyTrustedRoleHeader(headers, "commercial");
    assert.equal(headers.get(AUTH_ROLE_HEADER), "commercial");
  });

  it("ignores an invalid session role value", () => {
    const headers = new Headers({ [AUTH_ROLE_HEADER]: "admin" });
    applyTrustedRoleHeader(headers, "root");
    assert.equal(headers.get(AUTH_ROLE_HEADER), null);
  });
});
