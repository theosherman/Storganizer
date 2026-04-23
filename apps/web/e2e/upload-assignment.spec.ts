import { test, expect } from "./fixtures";

test("POST /api/items/upload forwards container_id form field", async ({ page }) => {
  let capturedBody: string | null = null;

  await page.route("**/api/items/upload", async (route) => {
    capturedBody = route.request().postData();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        item: {
          id: "itm-1",
          name: "Processing...",
          status: "processing",
          container_id: "ctr-1",
          container_name: "Bin 3",
        },
      }),
    });
  });

  await page.goto("/camera");
  await page.evaluate(async () => {
    const fd = new FormData();
    fd.append("photo", new Blob(["fake"], { type: "image/jpeg" }), "x.jpg");
    fd.append("container_id", "ctr-1");
    await fetch("/api/items/upload", { method: "POST", body: fd, credentials: "include" });
  });

  expect(capturedBody).toContain("container_id");
  expect(capturedBody).toContain("ctr-1");
});
