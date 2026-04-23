import { test, expect } from "./fixtures";

const item = {
  id: "itm-1",
  name: "Hammer",
  ai_label: "hammer",
  description: null,
  status: "ready",
  container_id: "ctr-1",
  container_name: "Toolbox",
  location_id: "loc-1",
  location_name: "Garage",
  created_at: "2026-04-22T00:00:00Z",
  photos: [{ id: "p1", r2_key: "x/y/p1.jpg", thumbnail_url: null, created_at: "x" }],
};

test.describe("Item detail", () => {
  test("renders name, container, location, save, delete", async ({ page }) => {
    await page.route("**/api/items/itm-1", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ item }) })
    );
    await page.route(/\/api\/containers(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          containers: [{ id: "ctr-1", name: "Toolbox", location_id: "loc-1", location_name: "Garage", item_count: 0, description: null, created_at: "x" }],
        }),
      })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locations: [{ id: "loc-1", name: "Garage", description: null, created_at: "x" }] }),
      })
    );
    await page.goto("/items/itm-1");
    await expect(page.locator('input[type="text"]').first()).toHaveValue("Hammer");
    await expect(page.getByRole("button", { name: /Save/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete/i })).toBeVisible();
  });

  test("delete calls DELETE and returns to Search", async ({ page }) => {
    let deleted = false;
    await page.route("**/api/items/itm-1", (route) => {
      if (route.request().method() === "DELETE") {
        deleted = true;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ item }) });
    });
    await page.route(/\/api\/containers(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ containers: [] }) })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations: [] }) })
    );
    page.once("dialog", (d) => d.accept());
    await page.goto("/items/itm-1");
    await page.getByRole("button", { name: /Delete/i }).click();
    await expect(page).toHaveURL("/");
    expect(deleted).toBe(true);
  });
});
