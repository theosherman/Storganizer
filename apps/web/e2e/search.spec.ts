import { test, expect } from "./fixtures";

test.describe("Search page", () => {
  test("shows search input", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("shows empty state when no items", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/no items/i)).toBeVisible();
  });

  test("renders item cards when API returns items", async ({ page }) => {
    await page.route(/\/api\/items(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "itm-1",
              name: "Hammer",
              ai_label: null,
              description: null,
              status: "ready",
              container_id: "ctr-1",
              container_name: "Toolbox",
              location_name: "Garage",
              thumbnail_key: null,
              created_at: "2026-04-22T00:00:00Z",
            },
          ],
        }),
      })
    );
    await page.goto("/");
    await expect(page.getByText("Hammer")).toBeVisible();
    await expect(page.getByText("Toolbox")).toBeVisible();
  });

  test("uses warm card surface", async ({ page }) => {
    await page.route(/\/api\/items(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "itm-1",
              name: "Hammer",
              status: "ready",
              container_id: null,
              container_name: null,
              location_name: null,
              thumbnail_key: null,
              ai_label: null,
              description: null,
              created_at: "2026-04-22T00:00:00Z",
            },
          ],
        }),
      })
    );
    await page.goto("/");
    const card = page.getByTestId("item-card").first();
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    // #1c1a17 → rgb(28, 26, 23)
    expect(bg).toBe("rgb(28, 26, 23)");
  });
});
