import { test, expect, makeTinyJpegBuffer } from "./fixtures";

test("green progress overlay appears on thumb during upload and reaches 100%", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", "native");
  });

  // Delay the upload response so the progress bar has visible time to grow.
  await page.route("**/api/items/upload", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        item: { id: "itm-progress", name: "Processing...", status: "uploading" },
      }),
    });
  });

  await page.goto("/camera");

  const buffer = await makeTinyJpegBuffer(page);

  const input = page.locator('input[type="file"][accept^="image/"]');
  await input.setInputFiles({
    name: "p.jpg",
    mimeType: "image/jpeg",
    buffer,
  });

  const bar = page.getByRole("progressbar").first();
  await expect(bar).toBeVisible();

  // Poll until the progressbar reports >= 99% (upload completes after the 800ms delay).
  await expect
    .poll(async () => Number(await bar.getAttribute("aria-valuenow")), {
      timeout: 5000,
    })
    .toBeGreaterThanOrEqual(99);
});
