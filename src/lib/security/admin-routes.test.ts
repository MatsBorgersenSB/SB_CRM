import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAuthSecret } from "@/lib/auth-env";
import { AUTH_ROLE_HEADER } from "@/types/auth";
import { requireAdminRole } from "./require-admin";

function req(role?: string): Request {
  const headers = new Headers();
  if (role) headers.set(AUTH_ROLE_HEADER, role);
  return new Request("http://localhost/api/administration/x", { headers });
}

describe("requireAdminRole", () => {
  it("rejects missing role and non-admin roles with 403", () => {
    for (const role of [undefined, "commercial", "engineer", "client_lead"]) {
      const result = requireAdminRole(req(role));
      assert.ok("error" in result, `role ${role} must be rejected`);
      assert.equal(result.error.status, 403);
    }
  });

  it("allows admin", () => {
    assert.ok(!("error" in requireAdminRole(req("admin"))));
  });
});

describe("resolveAuthSecret", () => {
  it("never returns the old committed production fallback", () => {
    const env = process.env as Record<string, string | undefined>;
    const saved = { ...env };
    delete env.NEXTAUTH_SECRET;
    delete env.AUTH_SECRET;
    try {
      env.NODE_ENV = "production";
      const a = resolveAuthSecret();
      assert.notEqual(a, "smartcrm-production-fallback-secret-2026");
      assert.ok(a.length >= 32);
      assert.equal(resolveAuthSecret(), a, "stable within a process");
    } finally {
      Object.assign(env, saved);
    }
  });
});
