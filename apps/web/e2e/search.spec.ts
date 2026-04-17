import { test, expect } from "./fixtures";

test.describe("Search page", () => {
  test("shows search input on homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test("shows empty state when no items", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=No items yet")).toBeVisible();
  });

  test("shows Add Items link in empty state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Add Items" }).first()).toBeVisible();
  });
});
