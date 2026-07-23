import { test, expect } from "@playwright/test";

test.describe("FS-016 · Health & auth smoke", () => {
  test("GET /api/health returns status ok", async ({ request }) => {
    // `e2e=1` keeps liveness green when Postgres is unavailable (dev / CI smoke).
    const response = await request.get("/api/health?e2e=1");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { status?: string };
    expect(body.status).toBe("ok");
  });

  test("root page loads with SmartCRM navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("SmartCRM", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Focus" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Opportunities" })).toBeVisible();
  });

  test("Role Switcher toggles enterprise badge ADMIN → MANAGER → REP", async ({
    page,
  }) => {
    await page.goto("/");

    const accessTier = page.locator("label").filter({ hasText: "Access Tier" }).locator("select");
    await expect(accessTier).toBeVisible();

    const enterpriseBadge = page
      .locator("span[title^='Enterprise role:']")
      .first();

    await accessTier.selectOption("superuser");
    await expect(enterpriseBadge).toHaveText("ADMIN");

    await accessTier.selectOption("commercial");
    await expect(enterpriseBadge).toHaveText("MANAGER");

    await accessTier.selectOption("engineer");
    await expect(enterpriseBadge).toHaveText("REP");
  });
});
