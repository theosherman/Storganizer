import { test as base, expect, type Page } from "@playwright/test";

/**
 * Build a tiny, decodable JPEG in the page via canvas.toBlob and return it
 * as a Node Buffer suitable for `input.setInputFiles({ ..., buffer })`.
 *
 * Used by camera-path specs where `createImageBitmap` (inside
 * resizeAndCompress) must succeed — raw bytes won't decode.
 */
export async function makeTinyJpegBuffer(page: Page, size = 32): Promise<Buffer> {
  const bytes = await page.evaluate(async (s) => {
    const canvas = document.createElement("canvas");
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, s, s);
    const blob = await new Promise<Blob>((r) =>
      canvas.toBlob((b) => r(b!), "image/jpeg", 0.9)
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, size);
  return Buffer.from(bytes);
}

export const TEST_USER = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
  avatar_url: null,
  role: "admin",
};

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: TEST_USER }) })
    );
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) })
    );
    await page.route(/\/api\/items(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) })
    );
    await page.route(/\/api\/containers(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ containers: [] }) })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations: [] }) })
    );
    await use(page);
  },
});

export { expect };
