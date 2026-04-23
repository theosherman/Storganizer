import { test, expect } from "./fixtures";

const itemOne = {
  id: "itm-1",
  name: "Thing",
  ai_label: null,
  description: null,
  status: "ready",
  container_id: null,
  container_name: null,
  location_name: null,
  thumbnail_key: null,
  created_at: "2026-04-22T00:00:00Z",
};

test.describe("EntityCombobox (via UnsortedCard)", () => {
  test("lists existing locations", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [itemOne] }) })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locations: [{ id: "loc-1", name: "Garage", description: null, created_at: "x" }] }),
      })
    );
    await page.goto("/unsorted");
    await page.getByTestId("location-combobox").click();
    await expect(page.getByRole("option", { name: "Garage" })).toBeVisible();
  });

  test("selecting a location writes default-location to localStorage", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [itemOne] }) })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locations: [{ id: "loc-1", name: "Garage", description: null, created_at: "x" }] }),
      })
    );
    await page.goto("/unsorted");
    await page.getByTestId("location-combobox").click();
    await page.getByRole("option", { name: "Garage" }).click();
    const v = await page.evaluate(() => localStorage.getItem("default-location"));
    // VueUse "any" serializer stores raw strings (no JSON quoting).
    expect(v).toBe("loc-1");
  });

  test("creates a new location when typed value has no match", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [itemOne] }) })
    );
    await page.route(/\/api\/locations$/, async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { name: string };
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ location: { id: "loc-new", name: body.name, description: null, created_at: "x" } }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations: [] }) });
      }
    });
    await page.goto("/unsorted");
    await page.getByTestId("location-combobox").click();
    await page.getByTestId("location-combobox").fill("Shed");
    const [response] = await Promise.all([
      page.waitForResponse(/\/api\/locations$/),
      page.getByRole("option", { name: /Create\s+"?Shed"?/i }).click(),
    ]);
    await response.finished();
    // wait for Vue's reactive flush to write the new value to localStorage
    await expect(page.getByTestId("location-combobox")).toHaveValue("Shed");
    const v = await page.evaluate(() => localStorage.getItem("default-location"));
    expect(v).toBe("loc-new");
  });
});
