import { test, expect } from "./fixtures";

test.describe("warm minimal theme", () => {
  test("body uses dark warm background", async ({ page }) => {
    await page.goto("/");
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    // #0f0e0c → rgb(15, 14, 12)
    expect(bg).toBe("rgb(15, 14, 12)");
  });

  test("accent color token is terracotta", async ({ page }) => {
    await page.goto("/");
    const accent = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return style.getPropertyValue("--color-accent").trim();
    });
    expect(accent.toLowerCase()).toBe("#d97706");
  });
});
