import { test, expect } from "./fixtures";

const unsortedItem = {
  id: "itm-1",
  name: "Pliers",
  ai_label: "pliers",
  description: null,
  status: "ready",
  container_id: null,
  container_name: null,
  location_name: null,
  thumbnail_key: null,
  created_at: "2026-04-22T00:00:00Z",
};

test.describe("Unsorted page", () => {
  test("lists unsorted items", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [unsortedItem] }),
      })
    );
    await page.goto("/unsorted");
    await expect(page.getByTestId("unsorted-card")).toHaveCount(1);
    await expect(page.getByTestId("unsorted-card").locator('input[type="text"]').first()).toHaveValue("Pliers");
  });

  test("shows 'Unsorted · N' count", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [unsortedItem, { ...unsortedItem, id: "itm-2", name: "Wrench" }] }),
      })
    );
    await page.goto("/unsorted");
    await expect(page.getByRole("heading", { name: /Unsorted · 2/ })).toBeVisible();
  });

  test("sort-it button PATCHes and removes the row", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [unsortedItem] }),
      })
    );
    await page.route(/\/api\/containers(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ containers: [{ id: "ctr-1", name: "Bin A", location_id: null, location_name: null, item_count: 0, description: null, created_at: "x" }] }),
      })
    );
    let patched = false;
    await page.route("**/api/items/itm-1", (route) => {
      patched = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item: { ...unsortedItem, container_id: "ctr-1", container_name: "Bin A" } }),
      });
    });

    await page.goto("/unsorted");
    const containerField = page.getByTestId("unsorted-card").first().getByTestId("container-combobox");
    await containerField.click();
    await page.getByRole("option", { name: "Bin A" }).click();
    await page.getByRole("button", { name: /Sort it/i }).click();

    await expect(page.getByTestId("unsorted-card")).toHaveCount(0);
    expect(patched).toBe(true);
  });
});
