import { test, expect, makeTinyJpegBuffer } from "./fixtures";

test("setting default in Unsorted carries through to Camera upload", async ({ page }) => {
  // Pre-seed camera-mode so Camera stays in native mode (avoids getUserMedia path).
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", "native");
  });

  const container = {
    id: "ctr-1",
    name: "Bin A",
    location_id: "loc-1",
    location_name: "Garage",
    item_count: 0,
    description: null,
    created_at: "x",
  };
  const unsorted = {
    id: "itm-1",
    name: "Widget",
    ai_label: null,
    description: null,
    status: "ready",
    container_id: null,
    container_name: null,
    location_name: null,
    thumbnail_key: null,
    created_at: "2026-04-22T00:00:00Z",
  };

  await page.route("**/api/items?unorganized=true", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [unsorted] }) })
  );
  await page.route(/\/api\/containers(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ containers: [container] }) })
  );
  await page.route(/\/api\/locations(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ locations: [{ id: "loc-1", name: "Garage", description: null, created_at: "x" }] }),
    })
  );

  // Step A — set container default from Unsorted.
  await page.goto("/unsorted");
  await page.getByTestId("container-combobox").click();
  await page.getByRole("option", { name: "Bin A" }).click();

  const stored = await page.evaluate(() => localStorage.getItem("default-container"));
  expect(stored).toBe("ctr-1");

  // Step B — navigate to Camera; verify upload POST carries container_id.
  let uploadBody: string | null = null;
  await page.route("**/api/items/upload", async (route) => {
    uploadBody = route.request().postData();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ item: { id: "itm-x", name: "Processing...", status: "uploading" } }),
    });
  });

  await page.goto("/camera");

  const buffer = await makeTinyJpegBuffer(page);

  const input = page.locator('input[type="file"][accept^="image/"]');
  const uploadWait = page.waitForResponse("**/api/items/upload");
  await input.setInputFiles({
    name: "x.jpg",
    mimeType: "image/jpeg",
    buffer,
  });
  await uploadWait;

  expect(uploadBody).not.toBeNull();
  expect(uploadBody).toContain("container_id");
  expect(uploadBody).toContain("ctr-1");
});
