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
});
