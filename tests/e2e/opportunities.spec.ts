import { test, expect } from "@playwright/test";

test.describe("FS-016 · Opportunities / deals smoke", () => {
  test("opportunities workspace loads pipeline stage filters", async ({ page }) => {
    await page.goto("/opportunities");

    await expect(page.getByText("Opportunities").first()).toBeVisible();
    await expect(page.getByText("SmartCRM", { exact: true }).first()).toBeVisible();

    const stageFilter = page.getByRole("button", { name: /^Stage/ });
    await expect(stageFilter).toBeVisible();
    await stageFilter.click();

    await expect(page.getByRole("option", { name: "Prospecting" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Feedstock Analysis" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Contract Negotiation" })).toBeVisible();
  });

  test("legacy /deals path redirects to opportunities", async ({ page }) => {
    await page.goto("/deals");

    await expect(page).toHaveURL(/\/opportunities/);
    await expect(page.getByText("Opportunities").first()).toBeVisible();
    await expect(page.getByText("SmartCRM", { exact: true }).first()).toBeVisible();
  });
});
