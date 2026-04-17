import { test, expect } from "./fixtures";

test.describe("Containers page", () => {
  test("shows empty state", async ({ page }) => {
    await page.goto("/containers");
    await expect(page.locator("text=No containers yet")).toBeVisible();
  });

  test("has New Container button", async ({ page }) => {
    await page.goto("/containers");
    await expect(page.getByRole("button", { name: "New Container" })).toBeVisible();
  });
});

test.describe("Locations page", () => {
  test("shows empty state", async ({ page }) => {
    await page.goto("/locations");
    await expect(page.locator("text=No locations yet")).toBeVisible();
  });

  test("has New Location button", async ({ page }) => {
    await page.goto("/locations");
    await expect(page.getByRole("button", { name: "New Location" })).toBeVisible();
  });
});
