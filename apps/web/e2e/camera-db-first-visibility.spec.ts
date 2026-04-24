import { test, expect, makeTinyJpegBuffer } from "./fixtures";

test("after uploading, navigating to Unsorted shows the new item without reload", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", "native");
  });

  let uploadedItem: { id: string; name: string; status: string } | null = null;

  await page.route("**/api/items/upload", async (route) => {
    uploadedItem = {
      id: "itm-visible",
      name: "Processing...",
      status: "uploading",
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ item: uploadedItem }),
    });
  });

  await page.route("**/api/items?unorganized=true", async (route) => {
    const items = uploadedItem ? [uploadedItem] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
  });

  await page.goto("/camera");
  const input = page.locator('input[type="file"][accept^="image/"]');
  // A real, decodable JPEG is required — compression needs a valid image.
  const buffer = await makeTinyJpegBuffer(page);
  await input.setInputFiles({
    name: "v.jpg",
    mimeType: "image/jpeg",
    buffer,
  });

  await page.waitForResponse("**/api/items/upload");

  await page.getByRole("link", { name: /Back/i }).click();
  await page.goto("/unsorted");

  await expect(page.getByRole("heading", { name: /Unsorted · 1/ })).toBeVisible();
  await expect(page.getByTestId("unsorted-card")).toHaveCount(1);
  await expect(
    page.getByTestId("unsorted-card").locator('input[type="text"]').first()
  ).toHaveValue("Processing...");
});
