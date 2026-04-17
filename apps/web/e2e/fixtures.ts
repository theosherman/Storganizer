import { test as base, expect } from "@playwright/test";

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
