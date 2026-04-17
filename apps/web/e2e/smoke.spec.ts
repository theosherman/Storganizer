import { test, expect } from "@playwright/test";

test("homepage loads with app name", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Storganizer").first()).toBeVisible();
});
