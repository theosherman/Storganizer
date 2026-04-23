import { test, expect } from "./fixtures";

test.describe("navigation shell", () => {
  test("shows top bar on Search and Unsorted", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Storganizer" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Unsorted" })).toBeVisible();
    await page.goto("/unsorted");
    await expect(page.getByRole("link", { name: "Unsorted" })).toBeVisible();
  });

  test("camera FAB routes to /camera on Search and Unsorted", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("camera-fab").click();
    await expect(page).toHaveURL("/camera");
    await page.goto("/unsorted");
    await page.getByTestId("camera-fab").click();
    await expect(page).toHaveURL("/camera");
  });

  test("camera screen has no top bar or FAB", async ({ page }) => {
    await page.goto("/camera");
    await expect(page.getByRole("link", { name: "Storganizer" })).toBeHidden();
    await expect(page.getByTestId("camera-fab")).toBeHidden();
  });

  test("removed routes redirect to Search", async ({ page }) => {
    await page.goto("/containers");
    await expect(page).toHaveURL("/");
    await page.goto("/locations");
    await expect(page).toHaveURL("/");
    await page.goto("/add");
    await expect(page).toHaveURL("/");
  });
});
