import { test, expect } from "./fixtures";

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

  // Build a real, decodable JPEG in-page so `createImageBitmap` (inside resizeAndCompress)
  // succeeds — the error we want to exercise is the UPLOAD failure (first 500), not the
  // client-side compression step. Without a decodable source, the thumb is never inserted
  // and there'd be no retry button to click.
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
    name: "r.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(smallJpeg),
  });

  const retry = page.getByRole("button", { name: /retry/i }).first();
  await expect(retry).toBeVisible();

  await retry.click();
  await page.waitForResponse(
    (resp) => resp.url().includes("/api/items/upload") && resp.status() === 201
  );

  await expect(page.locator("a[href='/items/itm-retry']")).toBeVisible();
});
