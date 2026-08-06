import { test, expect } from "@playwright/test";

test.describe("FS-016 · Health & auth smoke", () => {
  test("GET /api/health returns status ok", async ({ request }) => {
    // `e2e=1` keeps liveness green when Postgres is unavailable (dev / CI smoke).
    const response = await request.get("/api/health?e2e=1");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { status?: string };
    expect(body.status).toBe("ok");
  });

  test("unauthenticated root redirects to Microsoft sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(
      page.getByRole("button", { name: /Sign in with Microsoft 365/i }),
    ).toBeVisible();
  });

  test("sign-in page shows Standard Bio branding", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByText("SmartCRM")).toBeVisible();
    await expect(page.getByText(/Industrial Pyrolysis/i)).toBeVisible();
    await expect(page.getByText("Access Tier")).toHaveCount(0);
    await expect(page.getByText("IT Admin (Superuser)")).toHaveCount(0);
  });
});
