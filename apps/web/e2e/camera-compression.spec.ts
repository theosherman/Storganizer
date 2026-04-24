import { test, expect } from "./fixtures";

test("native-mode upload body is under 250KB even when source is a 5MB JPEG", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", "native");
  });

  let uploadedBytes: number | null = null;
  await page.route("**/api/items/upload", async (route) => {
    const buf = route.request().postDataBuffer();
    uploadedBytes = buf ? buf.byteLength : 0;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        item: { id: "itm-compressed", name: "Processing...", status: "uploading" },
      }),
    });
  });

  await page.goto("/camera");

  // Build a large, photo-like JPEG in-page so createImageBitmap can decode it.
  // Smooth gradients with a little noise mimic real photographs: the raw source
  // lands in the multi-MB range but compresses tightly, matching real uploads.
  const bigJpeg = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const n = Math.floor(Math.random() * 16);
        img.data[i] = ((x * 255) / canvas.width + n) | 0;
        img.data[i + 1] = ((y * 255) / canvas.height + n) | 0;
        img.data[i + 2] = (((x + y) * 127) / (canvas.width + canvas.height) + n) | 0;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.95));
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  });

  const input = page.locator('input[type="file"][accept^="image/"]');
  await input.setInputFiles({
    name: "big.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(bigJpeg),
  });

  await page.waitForResponse("**/api/items/upload");
  expect(uploadedBytes).not.toBeNull();
  expect(uploadedBytes!).toBeLessThan(250_000);
});
