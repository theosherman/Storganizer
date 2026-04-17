import { test, expect } from "./fixtures";

test.describe("Add Items page", () => {
  test("shows upload area", async ({ page }) => {
    await page.goto("/add");
    await expect(page.locator("text=Tap to take a photo")).toBeVisible();
  });

  test("has file input for photos", async ({ page }) => {
    await page.goto("/add");
    const input = page.locator('input[type="file"]');
    await expect(input).toBeAttached();
    expect(await input.getAttribute("accept")).toBe("image/*");
  });
});
