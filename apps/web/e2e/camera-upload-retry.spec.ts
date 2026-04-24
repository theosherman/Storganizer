import { test, expect, makeTinyJpegBuffer } from "./fixtures";

test("errored thumb becomes retry button; clicking retries and succeeds", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", "native");
  });

  let callCount = 0;
  await page.route("**/api/items/upload", async (route) => {
    callCount++;
    if (callCount === 1) {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    } else {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          item: { id: "itm-retry", name: "Processing...", status: "uploading" },
        }),
      });
    }
  });

  await page.goto("/camera");

  // A real, decodable JPEG is required so `createImageBitmap` (inside resizeAndCompress)
  // succeeds — the error we want to exercise is the UPLOAD failure (first 500), not the
  // client-side compression step. Without a decodable source, the thumb is never inserted
  // and there'd be no retry button to click.
  const buffer = await makeTinyJpegBuffer(page);

  const input = page.locator('input[type="file"][accept^="image/"]');
  await input.setInputFiles({
    name: "r.jpg",
    mimeType: "image/jpeg",
    buffer,
  });

  const retry = page.getByRole("button", { name: /retry/i }).first();
  await expect(retry).toBeVisible();

  await retry.click();
  await page.waitForResponse(
    (resp) => resp.url().includes("/api/items/upload") && resp.status() === 201
  );

  await expect(page.locator("a[href='/items/itm-retry']")).toBeVisible();
});
