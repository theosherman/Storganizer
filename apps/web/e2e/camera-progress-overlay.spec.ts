import { test, expect } from "./fixtures";

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

  // Build a real, decodable JPEG in-page so `createImageBitmap` won't reject it.
  const smallJpeg = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 32, 32);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.9));
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  });

  const input = page.locator('input[type="file"][accept^="image/"]');
  await input.setInputFiles({
    name: "p.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(smallJpeg),
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
