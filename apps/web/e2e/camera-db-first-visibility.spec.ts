import { test, expect } from "./fixtures";

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
  // Build a real, decodable JPEG in-page — compression requires a valid image.
  const smallJpeg = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 32, 32);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.9));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await input.setInputFiles({
    name: "v.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(smallJpeg),
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
