import { test, expect } from "./fixtures";

test("app loads with sidebar navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Storganizer").first()).toBeVisible();
});

test.describe("responsive layout", () => {
  test("sidebar visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.locator("aside")).toBeVisible();
  });
});

test.describe("navigation", () => {
  test("can navigate to all main pages", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.getByRole("link", { name: "Unsorted" }).click();
    await expect(page).toHaveURL("/unsorted");
    await page.getByRole("link", { name: "Containers" }).click();
    await expect(page).toHaveURL("/containers");
    await page.getByRole("link", { name: "Locations" }).click();
    await expect(page).toHaveURL("/locations");
  });
});
