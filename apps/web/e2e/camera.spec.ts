import { test, expect } from "./fixtures";

test.describe("Camera page — native mode", () => {
  test("shows back, mode toggle, dropdowns, shutter", async ({ page }) => {
    // Force native mode so getUserMedia isn't needed for this test.
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", "native");
    });
    await page.goto("/camera");
    await expect(page.getByRole("link", { name: /Back/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuous/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Native/i })).toBeVisible();
    await expect(page.getByTestId("container-combobox")).toBeVisible();
    await expect(page.getByTestId("location-combobox")).toBeVisible();
    await expect(page.getByTestId("shutter")).toBeVisible();
  });

  test("toggling modes persists to localStorage", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", "native");
    });
    await page.goto("/camera");
    await page.getByRole("button", { name: /Continuous/i }).click();
    const v1 = await page.evaluate(() => localStorage.getItem("camera-mode"));
    expect(v1).toBe("continuous");
    await page.getByRole("button", { name: /Native/i }).click();
    const v2 = await page.evaluate(() => localStorage.getItem("camera-mode"));
    expect(v2).toBe("native");
  });

  test("shutter triggers hidden file input in native mode", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", "native");
    });
    await page.goto("/camera");
    const input = page.locator('input[type="file"][accept^="image/"]');
    await expect(input).toBeAttached();
    await input.setInputFiles({
      name: "shot.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await expect(page.getByTestId("shutter")).toBeVisible();
  });

  test("falls back to native when getUserMedia rejects", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", "continuous");
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: () => Promise.reject(new Error("NotAllowedError")) },
      });
    });
    await page.goto("/camera");
    await expect(page.getByTestId("camera-fallback-notice")).toBeVisible();
    const v = await page.evaluate(() => localStorage.getItem("camera-mode"));
    expect(v).toBe("native");
  });

  test("continuous mode renders a <video> element when getUserMedia resolves", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", "continuous");
      const track = { stop() {} };
      const stream = { getTracks: () => [track] };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: () => Promise.resolve(stream) },
      });
    });
    await page.goto("/camera");
    await expect(page.locator("video[data-testid='viewfinder']")).toBeAttached();
  });

  test("continuous mode shutter overlays the viewfinder as a FAB", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", "continuous");
      const track = { stop() {} };
      const stream = { getTracks: () => [track] };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: () => Promise.resolve(stream) },
      });
    });
    await page.setViewportSize({ width: 375, height: 640 });
    await page.goto("/camera");
    const shutter = page.getByTestId("shutter");
    const video = page.locator("video[data-testid='viewfinder']");
    await expect(shutter).toBeVisible();
    const shutterBox = await shutter.boundingBox();
    const videoBox = await video.boundingBox();
    expect(shutterBox).not.toBeNull();
    expect(videoBox).not.toBeNull();
    // FAB sits within the video's vertical extent (overlaps the canvas).
    expect(shutterBox!.y).toBeGreaterThanOrEqual(videoBox!.y);
    expect(shutterBox!.y + shutterBox!.height).toBeLessThanOrEqual(
      videoBox!.y + videoBox!.height + 1
    );
    // And it's within the viewport.
    expect(shutterBox!.y + shutterBox!.height).toBeLessThanOrEqual(640);
  });

  test("uploaded photo appears in filmstrip and links to item", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", "native");
    });
    await page.route("**/api/items/upload", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          item: { id: "itm-99", name: "Processing...", status: "processing" },
        }),
      })
    );
    await page.goto("/camera");
    const input = page.locator('input[type="file"][accept^="image/"]');
    const uploadWait = page.waitForResponse("**/api/items/upload");
    await input.setInputFiles({
      name: "x.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    await uploadWait;
    await expect(page.locator("a[href='/items/itm-99']")).toBeVisible();
  });
});
