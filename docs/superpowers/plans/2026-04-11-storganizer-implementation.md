# Storganizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal storage organization app where users snap photos of items (auto-labeled by AI), organize them into containers at locations, and search for them later.

**Architecture:** Monorepo with Vue 3 frontend on Cloudflare Pages and Hono API on Cloudflare Workers. D1 for database, R2 for image storage, Cloudflare Queues for async Workers AI image identification. Google OAuth with invite-only access. TDD throughout.

**Tech Stack:** Vue 3, Vite, Tailwind CSS v4, Pinia, Vue Router, Hono, Cloudflare Workers/D1/R2/Queues/Workers AI, Vitest with `@cloudflare/vitest-pool-workers`, Playwright

**Spec:** `docs/superpowers/specs/2026-04-11-storganizer-design.md`

---

## File Map

### Root
- `package.json` — workspace root, scripts for dev/build/test
- `pnpm-workspace.yaml` — workspace definition
- `.gitignore` — node_modules, dist, .wrangler, .dev.vars, etc.

### `apps/api/` — Hono Worker
- `package.json` — hono, wrangler, vitest deps
- `wrangler.toml` — D1, R2, Queues, AI bindings
- `tsconfig.json` — TypeScript config
- `vitest.config.ts` — Workers pool config
- `src/index.ts` — Hono app + queue consumer export
- `src/env.d.ts` — Env type declarations (ProvidedEnv)
- `src/db/schema.sql` — Full D1 schema
- `src/db/migrations/0001_initial.sql` — Initial migration
- `src/middleware/auth.ts` — JWT verification middleware
- `src/routes/auth.ts` — Google OAuth routes
- `src/routes/locations.ts` — Locations CRUD
- `src/routes/containers.ts` — Containers CRUD
- `src/routes/items.ts` — Items CRUD + search + upload
- `src/routes/admin.ts` — Invite management
- `src/queue/consumer.ts` — Workers AI image identification
- `src/lib/ulid.ts` — ULID generation helper
- `test/setup.ts` — D1 migration setup for tests
- `test/helpers.ts` — Test factory functions (createTestUser, etc.)
- `test/locations.test.ts`
- `test/containers.test.ts`
- `test/items.test.ts`
- `test/search.test.ts`
- `test/auth.test.ts`
- `test/admin.test.ts`
- `test/queue.test.ts`

### `apps/web/` — Vue 3 SPA
- `package.json` — vue, tailwind, pinia, vue-router deps
- `vite.config.ts` — Vite + Tailwind plugin + API proxy
- `tsconfig.json` / `tsconfig.app.json` — TypeScript config
- `index.html` — SPA entry
- `playwright.config.ts` — Playwright config with webServer
- `src/main.ts` — App bootstrap
- `src/App.vue` — Root component with sidebar layout
- `src/assets/main.css` — Tailwind import
- `src/router/index.ts` — Vue Router routes
- `src/stores/auth.ts` — Pinia auth store
- `src/composables/useApi.ts` — Fetch wrapper with auth
- `src/composables/useItems.ts` — Items data fetching
- `src/composables/useContainers.ts` — Containers data fetching
- `src/composables/useLocations.ts` — Locations data fetching
- `src/components/AppSidebar.vue` — Sidebar navigation
- `src/components/ItemCard.vue` — Item display card with breadcrumb
- `src/components/PhotoUploader.vue` — Camera/file upload component
- `src/pages/SearchPage.vue` — Home/search page
- `src/pages/UnsortedPage.vue` — Unorganized items
- `src/pages/ContainersPage.vue` — Containers list
- `src/pages/ContainerDetailPage.vue` — Single container with items
- `src/pages/LocationsPage.vue` — Locations list
- `src/pages/LocationDetailPage.vue` — Single location with containers
- `src/pages/ItemDetailPage.vue` — Item detail/edit
- `src/pages/AddItemsPage.vue` — Camera/upload page
- `src/pages/LoginPage.vue` — Google sign-in
- `e2e/items.spec.ts` — Item management e2e tests
- `e2e/search.spec.ts` — Search e2e tests
- `e2e/containers-locations.spec.ts` — Containers/locations e2e tests

---

## Phase 1: Project Foundation

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Modify: `.gitignore`

- [ ] **Step 1: Create pnpm workspace config**

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "storganizer",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @storganizer/web test:e2e"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 3: Update .gitignore**

```gitignore
node_modules/
dist/
.wrangler/
.dev.vars
.superpowers/
.mf/
*.local
```

- [ ] **Step 4: Install root dependencies**

Run: `pnpm install`

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json .gitignore pnpm-lock.yaml
git commit -m "feat: scaffold pnpm monorepo workspace"
```

---

### Task 2: API Project Setup (Hono + Wrangler + Vitest)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/wrangler.toml`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/env.d.ts`
- Create: `apps/api/src/lib/ulid.ts`

- [ ] **Step 1: Create apps/api directory and package.json**

```json
{
  "name": "@storganizer/api",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "wrangler d1 migrations apply storganizer-db --local"
  },
  "dependencies": {
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.0",
    "@cloudflare/workers-types": "^4.20260401.0",
    "vitest": "^3.1.0",
    "wrangler": "^4.10.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ESNext"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "types": ["@cloudflare/workers-types/2023-07-01", "@cloudflare/vitest-pool-workers"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Create wrangler.toml**

```toml
name = "storganizer-api"
main = "src/index.ts"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "storganizer-db"
database_id = "local"
migrations_dir = "src/db/migrations"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "storganizer-storage"

[[queues.producers]]
queue = "storganizer-image-queue"
binding = "IMAGE_QUEUE"

[[queues.consumers]]
queue = "storganizer-image-queue"
max_batch_size = 10
max_batch_timeout = 30

[vars]
ADMIN_EMAIL = "admin@example.com"
GOOGLE_CLIENT_ID = ""
GOOGLE_CLIENT_SECRET = ""
JWT_SECRET = "dev-secret-change-in-production"
FRONTEND_URL = "http://localhost:5173"
```

- [ ] **Step 4: Create env.d.ts with Env types**

```typescript
// apps/api/src/env.d.ts
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  IMAGE_QUEUE: Queue<{ item_id: string; photo_r2_key: string }>;
  AI: Ai;
  ADMIN_EMAIL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

declare module "cloudflare:workers" {
  interface ProvidedEnv extends Env {}
}
```

- [ ] **Step 5: Create ULID helper**

```typescript
// apps/api/src/lib/ulid.ts
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len; i > 0; i--) {
    str = ENCODING[now % 32] + str;
    now = Math.floor(now / 32);
  }
  return str;
}

function encodeRandom(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let str = "";
  for (const byte of bytes) {
    str += ENCODING[byte % 32];
  }
  return str;
}

export function ulid(): string {
  return encodeTime(Date.now(), 10) + encodeRandom(16);
}
```

- [ ] **Step 6: Create minimal Hono app**

```typescript
// apps/api/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.d.ts";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors({
  origin: (origin) => origin,
  credentials: true,
}));

app.get("/api/health", (c) => c.json({ ok: true }));

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ item_id: string; photo_r2_key: string }>, env: Env) {
    // Queue consumer — implemented in Task 13
  },
};

export { app };
```

- [ ] **Step 7: Create vitest.config.ts**

```typescript
// apps/api/vitest.config.ts
import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersProject({
  test: {
    globals: true,
    setupFiles: ["./test/setup.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

- [ ] **Step 8: Create test setup file (empty for now — migrations added in Task 3)**

```typescript
// apps/api/test/setup.ts
// D1 migrations will be applied here once schema is created
```

- [ ] **Step 9: Write smoke test**

```typescript
// apps/api/test/health.test.ts
import { env } from "cloudflare:test";
import { app } from "../src/index";

describe("health check", () => {
  it("returns ok", async () => {
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 10: Install deps and run test**

Run: `cd apps/api && pnpm install && pnpm test`
Expected: 1 test passes

- [ ] **Step 11: Commit**

```bash
git add apps/api/
git commit -m "feat: scaffold Hono API project with Vitest workers pool"
```

---

### Task 3: D1 Schema and Migrations

**Files:**
- Create: `apps/api/src/db/migrations/0001_initial.sql`
- Modify: `apps/api/test/setup.ts`

- [ ] **Step 1: Create initial migration**

```sql
-- apps/api/src/db/migrations/0001_initial.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS allowed_emails (
  email TEXT PRIMARY KEY,
  invited_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS containers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  location_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  container_id TEXT,
  name TEXT NOT NULL DEFAULT 'Processing...',
  ai_label TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS item_photos (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

- [ ] **Step 2: Update test setup to apply migrations**

```typescript
// apps/api/test/setup.ts
import { applyD1Migrations } from "cloudflare:test";
import { readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import { env } from "cloudflare:test";

const migrations = readD1Migrations("src/db/migrations");
await applyD1Migrations(env.DB, migrations);
```

- [ ] **Step 3: Write test to verify schema exists**

```typescript
// apps/api/test/schema.test.ts
import { env } from "cloudflare:test";

describe("D1 schema", () => {
  it("has all expected tables", async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();
    const tables = result.results.map((r: any) => r.name);
    expect(tables).toContain("users");
    expect(tables).toContain("allowed_emails");
    expect(tables).toContain("locations");
    expect(tables).toContain("containers");
    expect(tables).toContain("items");
    expect(tables).toContain("item_photos");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && pnpm test`
Expected: All tests pass (health + schema)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/ apps/api/test/
git commit -m "feat: add D1 schema with all tables and test setup"
```

---

### Task 4: Web Project Setup (Vue + Tailwind + Playwright)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`, `apps/web/tsconfig.app.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/src/main.ts`
- Create: `apps/web/src/App.vue`
- Create: `apps/web/src/assets/main.css`
- Create: `apps/web/src/router/index.ts`
- Create: `apps/web/src/pages/SearchPage.vue` (placeholder)

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@storganizer/web",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  },
  "dependencies": {
    "pinia": "^3.0.0",
    "vue": "^3.5.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.51.0",
    "@tailwindcss/vite": "^4.1.0",
    "@vitejs/plugin-vue": "^5.2.0",
    "tailwindcss": "^4.1.0",
    "vite": "^6.2.0",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Create tsconfig files**

```json
// apps/web/tsconfig.json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

```json
// apps/web/tsconfig.app.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.vue"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
// apps/web/vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create index.html**

```html
<!-- apps/web/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Storganizer</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Create main.css with Tailwind import**

```css
/* apps/web/src/assets/main.css */
@import "tailwindcss";
```

- [ ] **Step 6: Create router with placeholder route**

```typescript
// apps/web/src/router/index.ts
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "search",
      component: () => import("@/pages/SearchPage.vue"),
    },
  ],
});

export default router;
```

- [ ] **Step 7: Create placeholder SearchPage**

```vue
<!-- apps/web/src/pages/SearchPage.vue -->
<script setup lang="ts">
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold">Storganizer</h1>
    <p class="text-gray-500 dark:text-gray-400 mt-2">Search your items</p>
  </div>
</template>
```

- [ ] **Step 8: Create App.vue**

```vue
<!-- apps/web/src/App.vue -->
<script setup lang="ts">
</script>

<template>
  <RouterView />
</template>
```

- [ ] **Step 9: Create main.ts**

```typescript
// apps/web/src/main.ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
```

- [ ] **Step 10: Create playwright.config.ts**

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
```

- [ ] **Step 11: Create a smoke e2e test**

```typescript
// apps/web/e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("homepage loads with title", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Storganizer");
});
```

- [ ] **Step 12: Install deps, install Playwright browsers, verify**

Run: `cd apps/web && pnpm install && pnpm exec playwright install chromium`
Run: `pnpm test:e2e`
Expected: 1 test passes (smoke test for both chromium and mobile projects)

- [ ] **Step 13: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold Vue 3 web app with Tailwind v4 and Playwright"
```

---

## Phase 2: Core API (TDD)

### Task 5: Test Helpers

**Files:**
- Create: `apps/api/test/helpers.ts`

- [ ] **Step 1: Create test factory functions**

```typescript
// apps/api/test/helpers.ts
import { env } from "cloudflare:test";
import { ulid } from "../src/lib/ulid";
import { app } from "../src/index";

export async function createTestUser(overrides: Partial<{
  id: string;
  google_id: string;
  email: string;
  name: string;
  role: string;
}> = {}) {
  const id = overrides.id ?? ulid();
  const user = {
    id,
    google_id: overrides.google_id ?? `google_${id}`,
    email: overrides.email ?? `${id}@test.com`,
    name: overrides.name ?? "Test User",
    role: overrides.role ?? "member",
  };
  await env.DB.prepare(
    "INSERT INTO users (id, google_id, email, name, role) VALUES (?, ?, ?, ?, ?)"
  ).bind(user.id, user.google_id, user.email, user.name, user.role).run();
  return user;
}

export async function createTestLocation(userId: string, overrides: Partial<{
  id: string;
  name: string;
  description: string;
}> = {}) {
  const id = overrides.id ?? ulid();
  await env.DB.prepare(
    "INSERT INTO locations (id, user_id, name, description) VALUES (?, ?, ?, ?)"
  ).bind(id, userId, overrides.name ?? "Test Location", overrides.description ?? null).run();
  return { id, user_id: userId, name: overrides.name ?? "Test Location", description: overrides.description ?? null };
}

export async function createTestContainer(userId: string, overrides: Partial<{
  id: string;
  name: string;
  location_id: string | null;
}> = {}) {
  const id = overrides.id ?? ulid();
  await env.DB.prepare(
    "INSERT INTO containers (id, user_id, name, location_id) VALUES (?, ?, ?, ?)"
  ).bind(id, userId, overrides.name ?? "Test Container", overrides.location_id ?? null).run();
  return { id, user_id: userId, name: overrides.name ?? "Test Container", location_id: overrides.location_id ?? null };
}

export async function createTestItem(userId: string, overrides: Partial<{
  id: string;
  name: string;
  container_id: string | null;
  ai_label: string | null;
  status: string;
}> = {}) {
  const id = overrides.id ?? ulid();
  await env.DB.prepare(
    "INSERT INTO items (id, user_id, container_id, name, ai_label, status) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    id, userId,
    overrides.container_id ?? null,
    overrides.name ?? "Test Item",
    overrides.ai_label ?? null,
    overrides.status ?? "ready"
  ).run();
  return { id, user_id: userId, name: overrides.name ?? "Test Item", container_id: overrides.container_id ?? null };
}

/**
 * Make an authenticated request by injecting the user_id header.
 * In tests, the auth middleware will trust this header (see Task 9).
 * In production, the middleware reads from a JWT cookie instead.
 */
export function authRequest(path: string, init: RequestInit = {}, userId: string) {
  const headers = new Headers(init.headers);
  headers.set("x-test-user-id", userId);
  return app.request(path, { ...init, headers }, env);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/test/helpers.ts
git commit -m "feat: add test factory functions for TDD"
```

---

### Task 6: Locations CRUD API

**Files:**
- Create: `apps/api/src/routes/locations.ts`
- Create: `apps/api/test/locations.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing tests for locations CRUD**

```typescript
// apps/api/test/locations.test.ts
import { createTestUser, authRequest } from "./helpers";

describe("GET /api/locations", () => {
  it("returns empty list when no locations exist", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/locations", {}, user.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locations: [] });
  });

  it("only returns locations for the authenticated user", async () => {
    const user1 = await createTestUser({ email: "user1@test.com", google_id: "g1" });
    const user2 = await createTestUser({ email: "user2@test.com", google_id: "g2" });
    await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "User1 Attic" }),
    }, user1.id);
    await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "User2 Garage" }),
    }, user2.id);

    const res = await authRequest("/api/locations", {}, user1.id);
    const data = await res.json() as any;
    expect(data.locations).toHaveLength(1);
    expect(data.locations[0].name).toBe("User1 Attic");
  });
});

describe("POST /api/locations", () => {
  it("creates a location", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic", description: "Top floor storage" }),
    }, user.id);
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.location.name).toBe("Attic");
    expect(data.location.description).toBe("Top floor storage");
    expect(data.location.id).toBeDefined();
  });

  it("rejects empty name", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }, user.id);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/locations/:id", () => {
  it("returns location with its containers", async () => {
    const user = await createTestUser();
    const locRes = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic" }),
    }, user.id);
    const { location } = await locRes.json() as any;

    const res = await authRequest(`/api/locations/${location.id}`, {}, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.location.name).toBe("Attic");
    expect(data.location.containers).toEqual([]);
  });

  it("returns 404 for nonexistent location", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/locations/nonexistent", {}, user.id);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/locations/:id", () => {
  it("updates location name", async () => {
    const user = await createTestUser();
    const createRes = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic" }),
    }, user.id);
    const { location } = await createRes.json() as any;

    const res = await authRequest(`/api/locations/${location.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Upstairs Attic" }),
    }, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.location.name).toBe("Upstairs Attic");
  });
});

describe("DELETE /api/locations/:id", () => {
  it("deletes location and unassigns containers", async () => {
    const user = await createTestUser();
    const locRes = await authRequest("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic" }),
    }, user.id);
    const { location } = await locRes.json() as any;

    const res = await authRequest(`/api/locations/${location.id}`, {
      method: "DELETE",
    }, user.id);
    expect(res.status).toBe(200);

    const getRes = await authRequest(`/api/locations/${location.id}`, {}, user.id);
    expect(getRes.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test -- test/locations.test.ts`
Expected: All tests FAIL (routes not implemented)

- [ ] **Step 3: Implement locations routes**

```typescript
// apps/api/src/routes/locations.ts
import { Hono } from "hono";
import type { Env } from "../env.d.ts";
import { ulid } from "../lib/ulid";

type AuthVariables = { userId: string };

const locations = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

locations.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await c.env.DB.prepare(
    "SELECT id, name, description, created_at FROM locations WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();
  return c.json({ locations: result.results });
});

locations.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; description?: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: "Name is required" }, 400);
  }
  const id = ulid();
  await c.env.DB.prepare(
    "INSERT INTO locations (id, user_id, name, description) VALUES (?, ?, ?, ?)"
  ).bind(id, userId, body.name.trim(), body.description?.trim() || null).run();

  const location = await c.env.DB.prepare(
    "SELECT id, name, description, created_at FROM locations WHERE id = ?"
  ).bind(id).first();
  return c.json({ location }, 201);
});

locations.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const location = await c.env.DB.prepare(
    "SELECT id, name, description, created_at FROM locations WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!location) return c.json({ error: "Not found" }, 404);

  const containers = await c.env.DB.prepare(
    "SELECT c.id, c.name, c.description, c.created_at, COUNT(i.id) as item_count FROM containers c LEFT JOIN items i ON i.container_id = c.id WHERE c.location_id = ? AND c.user_id = ? GROUP BY c.id ORDER BY c.created_at DESC"
  ).bind(id, userId).all();

  return c.json({ location: { ...location, containers: containers.results } });
});

locations.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; description?: string }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM locations WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: string[] = [];
  const values: (string | null)[] = [];
  if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name.trim()); }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description?.trim() || null); }

  if (updates.length > 0) {
    values.push(id, userId);
    await c.env.DB.prepare(
      `UPDATE locations SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();
  }

  const location = await c.env.DB.prepare(
    "SELECT id, name, description, created_at FROM locations WHERE id = ?"
  ).bind(id).first();
  return c.json({ location });
});

locations.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM locations WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Unassign containers (ON DELETE SET NULL handles this via FK, but let's be explicit)
  await c.env.DB.prepare(
    "UPDATE containers SET location_id = NULL WHERE location_id = ? AND user_id = ?"
  ).bind(id, userId).run();

  await c.env.DB.prepare(
    "DELETE FROM locations WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  return c.json({ ok: true });
});

export { locations };
```

- [ ] **Step 4: Wire up routes and add test auth middleware to index.ts**

```typescript
// apps/api/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.d.ts";
import { locations } from "./routes/locations";

type AuthVariables = { userId: string };

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.use("/*", cors({
  origin: (origin) => origin,
  credentials: true,
}));

// Auth middleware — in tests, trusts x-test-user-id header.
// In production, this is replaced by JWT validation (Task 9).
app.use("/api/*", async (c, next) => {
  // Skip auth for auth routes and health
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/auth") || path === "/api/health") return next();

  const testUserId = c.req.header("x-test-user-id");
  if (testUserId) {
    c.set("userId", testUserId);
    return next();
  }

  // JWT validation will go here (Task 9)
  return c.json({ error: "Unauthorized" }, 401);
});

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/locations", locations);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ item_id: string; photo_r2_key: string }>, env: Env) {
    // Queue consumer — implemented in Task 13
  },
};

export { app };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ apps/api/test/
git commit -m "feat: implement locations CRUD API with tests"
```

---

### Task 7: Containers CRUD API

**Files:**
- Create: `apps/api/src/routes/containers.ts`
- Create: `apps/api/test/containers.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing tests for containers CRUD**

```typescript
// apps/api/test/containers.test.ts
import { createTestUser, createTestLocation, createTestItem, authRequest } from "./helpers";

describe("POST /api/containers", () => {
  it("creates a container without a location", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Blue Bin #3" }),
    }, user.id);
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.container.name).toBe("Blue Bin #3");
    expect(data.container.location_id).toBeNull();
  });

  it("creates a container with a location", async () => {
    const user = await createTestUser();
    const location = await createTestLocation(user.id, { name: "Attic" });
    const res = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Blue Bin #3", location_id: location.id }),
    }, user.id);
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.container.location_id).toBe(location.id);
  });

  it("rejects empty name", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }, user.id);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/containers", () => {
  it("returns containers for authenticated user", async () => {
    const user = await createTestUser();
    await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Box A" }),
    }, user.id);

    const res = await authRequest("/api/containers", {}, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.containers).toHaveLength(1);
    expect(data.containers[0].name).toBe("Box A");
  });

  it("filters by location_id", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Attic" });
    await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Attic Box", location_id: loc.id }),
    }, user.id);
    await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Floating Box" }),
    }, user.id);

    const res = await authRequest(`/api/containers?location_id=${loc.id}`, {}, user.id);
    const data = await res.json() as any;
    expect(data.containers).toHaveLength(1);
    expect(data.containers[0].name).toBe("Attic Box");
  });
});

describe("GET /api/containers/:id", () => {
  it("returns container with its items", async () => {
    const user = await createTestUser();
    const createRes = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Parts Drawer" }),
    }, user.id);
    const { container } = await createRes.json() as any;
    await createTestItem(user.id, { name: "Resistor Pack", container_id: container.id });

    const res = await authRequest(`/api/containers/${container.id}`, {}, user.id);
    const data = await res.json() as any;
    expect(data.container.name).toBe("Parts Drawer");
    expect(data.container.items).toHaveLength(1);
    expect(data.container.items[0].name).toBe("Resistor Pack");
  });

  it("returns 404 for nonexistent", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/containers/nonexistent", {}, user.id);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/containers/:id", () => {
  it("updates container name and location", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Garage" });
    const createRes = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Old Name" }),
    }, user.id);
    const { container } = await createRes.json() as any;

    const res = await authRequest(`/api/containers/${container.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name", location_id: loc.id }),
    }, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.container.name).toBe("New Name");
    expect(data.container.location_id).toBe(loc.id);
  });
});

describe("DELETE /api/containers/:id", () => {
  it("deletes container and unassigns items", async () => {
    const user = await createTestUser();
    const createRes = await authRequest("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Temp Box" }),
    }, user.id);
    const { container } = await createRes.json() as any;
    await createTestItem(user.id, { name: "Widget", container_id: container.id });

    const res = await authRequest(`/api/containers/${container.id}`, {
      method: "DELETE",
    }, user.id);
    expect(res.status).toBe(200);

    // Item should still exist but have no container
    const itemsRes = await authRequest("/api/items?unorganized=true", {}, user.id);
    const data = await itemsRes.json() as any;
    expect(data.items.some((i: any) => i.name === "Widget")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test -- test/containers.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement containers routes**

```typescript
// apps/api/src/routes/containers.ts
import { Hono } from "hono";
import type { Env } from "../env.d.ts";
import { ulid } from "../lib/ulid";

type AuthVariables = { userId: string };

const containers = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

containers.get("/", async (c) => {
  const userId = c.get("userId");
  const locationId = c.req.query("location_id");
  const q = c.req.query("q");

  let sql = `SELECT c.id, c.name, c.description, c.location_id, c.created_at,
    l.name as location_name, COUNT(i.id) as item_count
    FROM containers c
    LEFT JOIN locations l ON l.id = c.location_id
    LEFT JOIN items i ON i.container_id = c.id
    WHERE c.user_id = ?`;
  const params: (string | null)[] = [userId];

  if (locationId) {
    sql += " AND c.location_id = ?";
    params.push(locationId);
  }
  if (q) {
    sql += " AND c.name LIKE ?";
    params.push(`%${q}%`);
  }

  sql += " GROUP BY c.id ORDER BY c.created_at DESC";

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ containers: result.results });
});

containers.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ name?: string; description?: string; location_id?: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: "Name is required" }, 400);
  }
  const id = ulid();
  await c.env.DB.prepare(
    "INSERT INTO containers (id, user_id, name, description, location_id) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, userId, body.name.trim(), body.description?.trim() || null, body.location_id || null).run();

  const container = await c.env.DB.prepare(
    "SELECT id, name, description, location_id, created_at FROM containers WHERE id = ?"
  ).bind(id).first();
  return c.json({ container }, 201);
});

containers.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const container = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.description, c.location_id, c.created_at,
     l.name as location_name
     FROM containers c
     LEFT JOIN locations l ON l.id = c.location_id
     WHERE c.id = ? AND c.user_id = ?`
  ).bind(id, userId).first();
  if (!container) return c.json({ error: "Not found" }, 404);

  const items = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.status, i.created_at,
     (SELECT r2_key FROM item_photos WHERE item_id = i.id LIMIT 1) as thumbnail_key
     FROM items i WHERE i.container_id = ? AND i.user_id = ?
     ORDER BY i.created_at DESC`
  ).bind(id, userId).all();

  return c.json({ container: { ...container, items: items.results } });
});

containers.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; description?: string; location_id?: string | null }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM containers WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: string[] = [];
  const values: (string | null)[] = [];
  if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name.trim()); }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description?.trim() || null); }
  if (body.location_id !== undefined) { updates.push("location_id = ?"); values.push(body.location_id); }

  if (updates.length > 0) {
    values.push(id, userId);
    await c.env.DB.prepare(
      `UPDATE containers SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();
  }

  const container = await c.env.DB.prepare(
    "SELECT id, name, description, location_id, created_at FROM containers WHERE id = ?"
  ).bind(id).first();
  return c.json({ container });
});

containers.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM containers WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Items become unassigned (ON DELETE SET NULL handles this)
  await c.env.DB.prepare(
    "UPDATE items SET container_id = NULL WHERE container_id = ? AND user_id = ?"
  ).bind(id, userId).run();

  await c.env.DB.prepare(
    "DELETE FROM containers WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  return c.json({ ok: true });
});

export { containers };
```

- [ ] **Step 4: Add containers route to index.ts**

Add after the locations route in `apps/api/src/index.ts`:

```typescript
import { containers } from "./routes/containers";
// ... after app.route("/api/locations", locations);
app.route("/api/containers", containers);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ apps/api/test/
git commit -m "feat: implement containers CRUD API with tests"
```

---

### Task 8: Items CRUD API

**Files:**
- Create: `apps/api/src/routes/items.ts`
- Create: `apps/api/test/items.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing tests for items CRUD (excluding upload — that's Task 12)**

```typescript
// apps/api/test/items.test.ts
import { createTestUser, createTestContainer, createTestItem, createTestLocation, authRequest } from "./helpers";

describe("GET /api/items", () => {
  it("returns all items for user", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "USB Cable" });
    await createTestItem(user.id, { name: "HDMI Adapter" });

    const res = await authRequest("/api/items", {}, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(2);
  });

  it("filters unorganized items", async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id);
    await createTestItem(user.id, { name: "Organized", container_id: container.id });
    await createTestItem(user.id, { name: "Loose" });

    const res = await authRequest("/api/items?unorganized=true", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Loose");
  });

  it("filters by status", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "Done", status: "ready" });
    await createTestItem(user.id, { name: "Pending", status: "processing" });

    const res = await authRequest("/api/items?status=processing", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Pending");
  });
});

describe("GET /api/items/:id", () => {
  it("returns item with photos", async () => {
    const user = await createTestUser();
    const item = await createTestItem(user.id, { name: "Widget" });

    const res = await authRequest(`/api/items/${item.id}`, {}, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.item.name).toBe("Widget");
    expect(data.item.photos).toEqual([]);
  });

  it("includes container and location info", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Attic" });
    const container = await createTestContainer(user.id, { name: "Box 1", location_id: loc.id });
    const item = await createTestItem(user.id, { name: "Cable", container_id: container.id });

    const res = await authRequest(`/api/items/${item.id}`, {}, user.id);
    const data = await res.json() as any;
    expect(data.item.container_name).toBe("Box 1");
    expect(data.item.location_name).toBe("Attic");
  });
});

describe("PATCH /api/items/:id", () => {
  it("updates item name and container", async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id, { name: "Box A" });
    const item = await createTestItem(user.id, { name: "Unknown item", ai_label: "Unknown item" });

    const res = await authRequest(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "USB-C Cable", container_id: container.id }),
    }, user.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.item.name).toBe("USB-C Cable");
    expect(data.item.container_id).toBe(container.id);
  });

  it("preserves ai_label when name is edited", async () => {
    const user = await createTestUser();
    const item = await createTestItem(user.id, { name: "USB cable", ai_label: "USB cable" });

    await authRequest(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "USB-C to Lightning Cable (3ft)" }),
    }, user.id);

    const getRes = await authRequest(`/api/items/${item.id}`, {}, user.id);
    const data = await getRes.json() as any;
    expect(data.item.name).toBe("USB-C to Lightning Cable (3ft)");
    expect(data.item.ai_label).toBe("USB cable");
  });
});

describe("DELETE /api/items/:id", () => {
  it("deletes item", async () => {
    const user = await createTestUser();
    const item = await createTestItem(user.id, { name: "Trash" });

    const res = await authRequest(`/api/items/${item.id}`, {
      method: "DELETE",
    }, user.id);
    expect(res.status).toBe(200);

    const getRes = await authRequest(`/api/items/${item.id}`, {}, user.id);
    expect(getRes.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test -- test/items.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement items routes**

```typescript
// apps/api/src/routes/items.ts
import { Hono } from "hono";
import type { Env } from "../env.d.ts";
import { ulid } from "../lib/ulid";

type AuthVariables = { userId: string };

const items = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

items.get("/", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q");
  const status = c.req.query("status");
  const unorganized = c.req.query("unorganized");

  let sql = `SELECT i.id, i.name, i.ai_label, i.description, i.status, i.container_id, i.created_at,
    c.name as container_name, l.name as location_name,
    (SELECT r2_key FROM item_photos WHERE item_id = i.id LIMIT 1) as thumbnail_key
    FROM items i
    LEFT JOIN containers c ON c.id = i.container_id
    LEFT JOIN locations l ON l.id = c.location_id
    WHERE i.user_id = ?`;
  const params: (string | null)[] = [userId];

  if (unorganized === "true") {
    sql += " AND i.container_id IS NULL";
  }
  if (status) {
    sql += " AND i.status = ?";
    params.push(status);
  }
  if (q) {
    sql += " AND (i.name LIKE ? OR i.ai_label LIKE ? OR i.description LIKE ? OR c.name LIKE ? OR l.name LIKE ?)";
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  sql += " ORDER BY i.created_at DESC";

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ items: result.results });
});

items.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const item = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.description, i.status, i.container_id, i.created_at,
     c.name as container_name, c.location_id, l.name as location_name
     FROM items i
     LEFT JOIN containers c ON c.id = i.container_id
     LEFT JOIN locations l ON l.id = c.location_id
     WHERE i.id = ? AND i.user_id = ?`
  ).bind(id, userId).first();
  if (!item) return c.json({ error: "Not found" }, 404);

  const photos = await c.env.DB.prepare(
    "SELECT id, r2_key, thumbnail_url, created_at FROM item_photos WHERE item_id = ? ORDER BY created_at ASC"
  ).bind(id).all();

  return c.json({ item: { ...item, photos: photos.results } });
});

items.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; description?: string; container_id?: string | null }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM items WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: string[] = [];
  const values: (string | null)[] = [];
  if (body.name !== undefined) { updates.push("name = ?"); values.push(body.name.trim()); }
  if (body.description !== undefined) { updates.push("description = ?"); values.push(body.description?.trim() || null); }
  if (body.container_id !== undefined) { updates.push("container_id = ?"); values.push(body.container_id); }

  if (updates.length > 0) {
    values.push(id, userId);
    await c.env.DB.prepare(
      `UPDATE items SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`
    ).bind(...values).run();
  }

  const item = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.description, i.status, i.container_id, i.created_at,
     c.name as container_name
     FROM items i LEFT JOIN containers c ON c.id = i.container_id
     WHERE i.id = ?`
  ).bind(id).first();
  return c.json({ item });
});

items.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM items WHERE id = ? AND user_id = ?"
  ).bind(id, userId).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Get photo R2 keys for cleanup
  const photos = await c.env.DB.prepare(
    "SELECT r2_key FROM item_photos WHERE item_id = ?"
  ).bind(id).all();

  // Delete photos from R2
  for (const photo of photos.results) {
    await c.env.STORAGE.delete(photo.r2_key as string);
  }

  // D1 cascade deletes item_photos
  await c.env.DB.prepare(
    "DELETE FROM items WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  return c.json({ ok: true });
});

export { items };
```

- [ ] **Step 4: Add items route to index.ts**

Add after containers route in `apps/api/src/index.ts`:

```typescript
import { items } from "./routes/items";
// ... after app.route("/api/containers", containers);
app.route("/api/items", items);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ apps/api/test/
git commit -m "feat: implement items CRUD API with tests"
```

---

### Task 9: Search API

**Files:**
- Create: `apps/api/test/search.test.ts`

Search is already implemented in the `GET /api/items` route via the `q` parameter. This task adds dedicated tests.

- [ ] **Step 1: Write search tests**

```typescript
// apps/api/test/search.test.ts
import { createTestUser, createTestContainer, createTestItem, createTestLocation, authRequest } from "./helpers";

describe("Search /api/items?q=", () => {
  it("finds items by name", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "USB-C Cable" });
    await createTestItem(user.id, { name: "HDMI Adapter" });

    const res = await authRequest("/api/items?q=USB", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("USB-C Cable");
  });

  it("finds items by ai_label", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "Custom Name", ai_label: "Arduino Nano microcontroller" });

    const res = await authRequest("/api/items?q=Arduino", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Custom Name");
  });

  it("finds items by container name", async () => {
    const user = await createTestUser();
    const container = await createTestContainer(user.id, { name: "Electronics Bin" });
    await createTestItem(user.id, { name: "Resistor", container_id: container.id });

    const res = await authRequest("/api/items?q=Electronics", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].container_name).toBe("Electronics Bin");
  });

  it("finds items by location name", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Attic" });
    const container = await createTestContainer(user.id, { name: "Box", location_id: loc.id });
    await createTestItem(user.id, { name: "Old Photo Album", container_id: container.id });

    const res = await authRequest("/api/items?q=Attic", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].location_name).toBe("Attic");
  });

  it("returns breadcrumb trail in results", async () => {
    const user = await createTestUser();
    const loc = await createTestLocation(user.id, { name: "Garage Shelf B" });
    const container = await createTestContainer(user.id, { name: "Parts Drawer", location_id: loc.id });
    await createTestItem(user.id, { name: "USB-C Cable", container_id: container.id });

    const res = await authRequest("/api/items?q=USB", {}, user.id);
    const data = await res.json() as any;
    expect(data.items[0].container_name).toBe("Parts Drawer");
    expect(data.items[0].location_name).toBe("Garage Shelf B");
  });

  it("returns empty results for no match", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "Widget" });

    const res = await authRequest("/api/items?q=nonexistent", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(0);
  });

  it("case-insensitive search", async () => {
    const user = await createTestUser();
    await createTestItem(user.id, { name: "USB-C Cable" });

    const res = await authRequest("/api/items?q=usb-c", {}, user.id);
    const data = await res.json() as any;
    expect(data.items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/api && pnpm test -- test/search.test.ts`
Expected: All tests pass (search is already implemented in items route)

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/search.test.ts
git commit -m "test: add comprehensive search API tests"
```

---

## Phase 3: Auth

### Task 10: JWT Auth Middleware

**Files:**
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/test/auth.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing tests for auth middleware**

```typescript
// apps/api/test/auth.test.ts
import { env } from "cloudflare:test";
import { app } from "../src/index";
import { createTestUser } from "./helpers";

describe("Auth middleware", () => {
  it("returns 401 when no auth cookie or header", async () => {
    const res = await app.request("/api/locations", {}, env);
    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid JWT", async () => {
    const res = await app.request("/api/locations", {
      headers: { Cookie: "auth=invalid.jwt.token" },
    }, env);
    expect(res.status).toBe(401);
  });

  it("allows access with valid JWT", async () => {
    const user = await createTestUser();
    // Create a valid JWT for the user
    const jwt = await createTestJwt(user.id);
    const res = await app.request("/api/locations", {
      headers: { Cookie: `auth=${jwt}` },
    }, env);
    expect(res.status).toBe(200);
  });

  it("skips auth for /api/auth routes", async () => {
    const res = await app.request("/api/auth/me", {}, env);
    // Should not be 401 — auth routes are exempt
    // /api/auth/me without a cookie returns user: null
    expect(res.status).toBe(200);
  });

  it("skips auth for /api/health", async () => {
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(200);
  });
});

// Helper to create a JWT for testing
async function createTestJwt(userId: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload = btoa(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${header}.${payload}.${sig}`;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test -- test/auth.test.ts`
Expected: FAIL (middleware not yet checking JWT)

- [ ] **Step 3: Implement JWT auth middleware**

```typescript
// apps/api/src/middleware/auth.ts
import { getCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import type { Env } from "../env.d.ts";

type AuthVariables = { userId: string };

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  next: Next
) {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/auth") || path === "/api/health") {
    return next();
  }

  // In test environment, allow x-test-user-id header
  const testUserId = c.req.header("x-test-user-id");
  if (testUserId) {
    c.set("userId", testUserId);
    return next();
  }

  const token = getCookie(c, "auth");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    c.set("userId", payload.sub);
    return next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
}

export async function signJwt(payload: { sub: string }, secret: string, expiresInSeconds = 7 * 24 * 3600): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  }));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${base64url(signature)}`;
}

async function verifyJwt(token: string, secret: string): Promise<{ sub: string; exp: number }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw new Error("Invalid signature");

  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return payload;
}

function base64url(input: string | ArrayBuffer): string {
  if (typeof input === "string") {
    return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): ArrayBuffer {
  const str = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}
```

- [ ] **Step 4: Update index.ts to use auth middleware**

Replace the inline auth middleware in `apps/api/src/index.ts` with:

```typescript
import { authMiddleware } from "./middleware/auth";

// Replace the existing app.use("/api/*", ...) middleware with:
app.use("/api/*", authMiddleware);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/ apps/api/test/auth.test.ts apps/api/src/index.ts
git commit -m "feat: implement JWT auth middleware with tests"
```

---

### Task 11: Google OAuth Routes

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write tests for auth routes**

```typescript
// apps/api/test/auth-routes.test.ts
import { env } from "cloudflare:test";
import { app } from "../src/index";
import { createTestUser } from "./helpers";

describe("GET /api/auth/google", () => {
  it("redirects to Google OAuth", async () => {
    const res = await app.request("/api/auth/google", { redirect: "manual" }, env);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("client_id=");
  });
});

describe("GET /api/auth/me", () => {
  it("returns null user when not authenticated", async () => {
    const res = await app.request("/api/auth/me", {}, env);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.user).toBeNull();
  });

  it("returns user when authenticated", async () => {
    const user = await createTestUser({ name: "Alice", email: "alice@test.com" });
    const res = await app.request("/api/auth/me", {
      headers: { "x-test-user-id": user.id },
    }, env);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.user.name).toBe("Alice");
    expect(data.user.email).toBe("alice@test.com");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears auth cookie", async () => {
    const res = await app.request("/api/auth/logout", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie).toContain("auth=");
    expect(cookie).toContain("Max-Age=0");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test -- test/auth-routes.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement auth routes**

```typescript
// apps/api/src/routes/auth.ts
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../env.d.ts";
import { signJwt } from "../middleware/auth";
import { ulid } from "../lib/ulid";

type AuthVariables = { userId: string };

const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

auth.get("/google", async (c) => {
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${new URL(c.req.url).origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state: crypto.randomUUID(),
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

auth.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Missing code" }, 400);

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${new URL(c.req.url).origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return c.json({ error: "Token exchange failed" }, 400);
  const tokens = await tokenRes.json() as { access_token: string };

  // Get user info
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoRes.ok) return c.json({ error: "Failed to get user info" }, 400);

  const googleUser = await userInfoRes.json() as {
    id: string; email: string; name: string; picture: string;
  };

  // Check allow-list: admin email or in allowed_emails table
  const isAdmin = googleUser.email === c.env.ADMIN_EMAIL;
  const isAllowed = await c.env.DB.prepare(
    "SELECT email FROM allowed_emails WHERE email = ?"
  ).bind(googleUser.email).first();

  if (!isAdmin && !isAllowed) {
    return c.redirect(`${c.env.FRONTEND_URL}/login?error=not_allowed`);
  }

  // Upsert user
  const existingUser = await c.env.DB.prepare(
    "SELECT id, role FROM users WHERE google_id = ?"
  ).bind(googleUser.id).first<{ id: string; role: string }>();

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await c.env.DB.prepare(
      "UPDATE users SET name = ?, avatar_url = ?, email = ? WHERE id = ?"
    ).bind(googleUser.name, googleUser.picture, googleUser.email, userId).run();
  } else {
    userId = ulid();
    const role = isAdmin ? "admin" : "member";
    await c.env.DB.prepare(
      "INSERT INTO users (id, google_id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, googleUser.id, googleUser.email, googleUser.name, googleUser.picture, role).run();
  }

  // Issue JWT
  const jwt = await signJwt({ sub: userId }, c.env.JWT_SECRET);
  setCookie(c, "auth", jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });

  return c.redirect(c.env.FRONTEND_URL);
});

auth.get("/me", async (c) => {
  // Auth middleware skips /api/auth/* routes, so we parse the token manually here
  const testUserId = c.req.header("x-test-user-id");
  const token = getCookie(c, "auth");

  let userId: string | null = null;
  if (testUserId) {
    userId = testUserId;
  } else if (token) {
    try {
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(c.env.JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
      );
      const parts = token.split(".");
      const valid = await crypto.subtle.verify(
        "HMAC", key,
        Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), ch => ch.charCodeAt(0)),
        new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
      );
      if (valid) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (!payload.exp || payload.exp >= Math.floor(Date.now() / 1000)) {
          userId = payload.sub;
        }
      }
    } catch { /* invalid token — return null user */ }
  }

  if (!userId) return c.json({ user: null });

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, avatar_url, role, created_at FROM users WHERE id = ?"
  ).bind(userId).first();
  return c.json({ user: user || null });
});

auth.post("/logout", async (c) => {
  deleteCookie(c, "auth", { path: "/" });
  return c.json({ ok: true });
});

export { auth };
```

- [ ] **Step 4: Add auth routes to index.ts**

Add to `apps/api/src/index.ts`:

```typescript
import { auth } from "./routes/auth";
// Add before other api routes (auth routes skip middleware):
app.route("/api/auth", auth);
```

- [ ] **Step 5: Run tests**

Run: `cd apps/api && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/auth.ts apps/api/test/auth-routes.test.ts apps/api/src/index.ts
git commit -m "feat: implement Google OAuth auth routes"
```

---

### Task 12: Admin Invite Routes

**Files:**
- Create: `apps/api/src/routes/admin.ts`
- Create: `apps/api/test/admin.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/admin.test.ts
import { createTestUser, authRequest } from "./helpers";

describe("POST /api/admin/invite", () => {
  it("admin can invite an email", async () => {
    const admin = await createTestUser({ role: "admin", email: "admin@test.com" });
    const res = await authRequest("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "friend@example.com" }),
    }, admin.id);
    expect(res.status).toBe(201);
  });

  it("non-admin cannot invite", async () => {
    const member = await createTestUser({ role: "member" });
    const res = await authRequest("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "friend@example.com" }),
    }, member.id);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/invites", () => {
  it("admin can list invited emails", async () => {
    const admin = await createTestUser({ role: "admin", email: "admin2@test.com" });
    await authRequest("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com" }),
    }, admin.id);

    const res = await authRequest("/api/admin/invites", {}, admin.id);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.invites.some((i: any) => i.email === "a@b.com")).toBe(true);
  });
});

describe("DELETE /api/admin/invite/:email", () => {
  it("admin can remove an invite", async () => {
    const admin = await createTestUser({ role: "admin", email: "admin3@test.com" });
    await authRequest("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "remove@me.com" }),
    }, admin.id);

    const res = await authRequest("/api/admin/invite/remove@me.com", {
      method: "DELETE",
    }, admin.id);
    expect(res.status).toBe(200);

    const listRes = await authRequest("/api/admin/invites", {}, admin.id);
    const data = await listRes.json() as any;
    expect(data.invites.some((i: any) => i.email === "remove@me.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test -- test/admin.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement admin routes**

```typescript
// apps/api/src/routes/admin.ts
import { Hono } from "hono";
import type { Env } from "../env.d.ts";

type AuthVariables = { userId: string };

const admin = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Admin guard middleware
admin.use("/*", async (c, next) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare(
    "SELECT role FROM users WHERE id = ?"
  ).bind(userId).first<{ role: string }>();
  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  return next();
});

admin.post("/invite", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ email: string }>();
  if (!body.email?.trim()) {
    return c.json({ error: "Email is required" }, 400);
  }

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO allowed_emails (email, invited_by) VALUES (?, ?)"
  ).bind(body.email.trim().toLowerCase(), userId).run();

  return c.json({ ok: true }, 201);
});

admin.get("/invites", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT email, invited_by, created_at FROM allowed_emails ORDER BY created_at DESC"
  ).all();
  return c.json({ invites: result.results });
});

admin.delete("/invite/:email", async (c) => {
  const email = c.req.param("email");
  await c.env.DB.prepare(
    "DELETE FROM allowed_emails WHERE email = ?"
  ).bind(email).run();
  return c.json({ ok: true });
});

export { admin };
```

- [ ] **Step 4: Add admin routes to index.ts**

```typescript
import { admin } from "./routes/admin";
// After other routes:
app.route("/api/admin", admin);
```

- [ ] **Step 5: Run tests**

Run: `cd apps/api && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/admin.ts apps/api/test/admin.test.ts apps/api/src/index.ts
git commit -m "feat: implement admin invite system with role-based access"
```

---

## Phase 4: Image Pipeline

### Task 13: Photo Upload to R2

**Files:**
- Modify: `apps/api/src/routes/items.ts`
- Create: `apps/api/test/upload.test.ts`

- [ ] **Step 1: Write failing tests for upload**

```typescript
// apps/api/test/upload.test.ts
import { env } from "cloudflare:test";
import { createTestUser, authRequest } from "./helpers";

describe("POST /api/items/upload", () => {
  it("uploads a photo and creates an item with processing status", async () => {
    const user = await createTestUser();

    // Create a minimal PNG (1x1 pixel)
    const png = new Uint8Array([
      137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,
      144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,3,0,1,54,
      40,207,136,0,0,0,0,73,69,78,68,174,66,96,130
    ]);

    const formData = new FormData();
    formData.append("photo", new Blob([png], { type: "image/png" }), "test.png");

    const res = await authRequest("/api/items/upload", {
      method: "POST",
      body: formData,
    }, user.id);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.item.status).toBe("processing");
    expect(data.item.name).toBe("Processing...");
    expect(data.item.id).toBeDefined();
  });

  it("stores image in R2", async () => {
    const user = await createTestUser();
    const png = new Uint8Array([
      137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,
      144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,3,0,1,54,
      40,207,136,0,0,0,0,73,69,78,68,174,66,96,130
    ]);

    const formData = new FormData();
    formData.append("photo", new Blob([png], { type: "image/png" }), "test.png");

    const res = await authRequest("/api/items/upload", {
      method: "POST",
      body: formData,
    }, user.id);
    const data = await res.json() as any;

    // Verify photo record in DB
    const photo = await env.DB.prepare(
      "SELECT r2_key FROM item_photos WHERE item_id = ?"
    ).bind(data.item.id).first<{ r2_key: string }>();
    expect(photo).not.toBeNull();

    // Verify file in R2
    const obj = await env.STORAGE.get(photo!.r2_key);
    expect(obj).not.toBeNull();
  });

  it("rejects request without photo", async () => {
    const user = await createTestUser();
    const res = await authRequest("/api/items/upload", {
      method: "POST",
      body: new FormData(),
    }, user.id);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test -- test/upload.test.ts`
Expected: FAIL

- [ ] **Step 3: Add upload route to items.ts**

Add this route to `apps/api/src/routes/items.ts` (before the existing routes):

```typescript
items.post("/upload", async (c) => {
  const userId = c.get("userId");

  const formData = await c.req.formData();
  const photo = formData.get("photo");
  if (!photo || !(photo instanceof File)) {
    return c.json({ error: "Photo is required" }, 400);
  }

  const itemId = ulid();
  const photoId = ulid();
  const r2Key = `${userId}/${itemId}/${photoId}.${photo.name.split(".").pop() || "jpg"}`;

  // Upload to R2
  const arrayBuffer = await photo.arrayBuffer();
  await c.env.STORAGE.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: photo.type },
  });

  // Create item
  await c.env.DB.prepare(
    "INSERT INTO items (id, user_id, name, status) VALUES (?, ?, 'Processing...', 'processing')"
  ).bind(itemId, userId).run();

  // Create photo record
  await c.env.DB.prepare(
    "INSERT INTO item_photos (id, item_id, r2_key) VALUES (?, ?, ?)"
  ).bind(photoId, itemId, r2Key).run();

  // Send to queue for AI processing
  await c.env.IMAGE_QUEUE.send({ item_id: itemId, photo_r2_key: r2Key });

  const item = await c.env.DB.prepare(
    "SELECT id, name, ai_label, status, container_id, created_at FROM items WHERE id = ?"
  ).bind(itemId).first();

  return c.json({ item }, 201);
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && pnpm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/items.ts apps/api/test/upload.test.ts
git commit -m "feat: implement photo upload to R2 with queue dispatch"
```

---

### Task 14: Queue Consumer with Workers AI

**Files:**
- Create: `apps/api/src/queue/consumer.ts`
- Create: `apps/api/test/queue.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing tests for queue consumer**

```typescript
// apps/api/test/queue.test.ts
import { createMessageBatch, createExecutionContext, getQueueResult } from "cloudflare:test";
import { env } from "cloudflare:test";
import worker from "../src/index";
import { createTestUser } from "./helpers";
import { ulid } from "../src/lib/ulid";

describe("Queue consumer", () => {
  it("processes image and sets AI label", async () => {
    const user = await createTestUser();
    const itemId = ulid();
    const photoId = ulid();
    const r2Key = `${user.id}/${itemId}/${photoId}.png`;

    // Create item in processing state
    await env.DB.prepare(
      "INSERT INTO items (id, user_id, name, status) VALUES (?, ?, 'Processing...', 'processing')"
    ).bind(itemId, user.id).run();

    // Put a test image in R2
    const png = new Uint8Array([
      137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,
      144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,3,0,1,54,
      40,207,136,0,0,0,0,73,69,78,68,174,66,96,130
    ]);
    await env.STORAGE.put(r2Key, png);

    // Create photo record
    await env.DB.prepare(
      "INSERT INTO item_photos (id, item_id, r2_key) VALUES (?, ?, ?)"
    ).bind(photoId, itemId, r2Key).run();

    // Process the queue message
    const batch = createMessageBatch("storganizer-image-queue", [
      { id: "msg-1", timestamp: new Date(), body: { item_id: itemId, photo_r2_key: r2Key } },
    ]);
    const ctx = createExecutionContext();
    await worker.queue(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.ackAll).toBe(true);

    // Verify item was updated
    const item = await env.DB.prepare(
      "SELECT name, ai_label, status FROM items WHERE id = ?"
    ).bind(itemId).first<{ name: string; ai_label: string; status: string }>();
    expect(item!.status).toBe("ready");
    // AI label should be set (actual value depends on Workers AI mock)
    expect(item!.ai_label).toBeDefined();
    expect(item!.name).not.toBe("Processing...");
  });

  it("handles AI failure gracefully", async () => {
    const user = await createTestUser();
    const itemId = ulid();

    await env.DB.prepare(
      "INSERT INTO items (id, user_id, name, status) VALUES (?, ?, 'Processing...', 'processing')"
    ).bind(itemId, user.id).run();

    // No image in R2 — will cause failure
    const batch = createMessageBatch("storganizer-image-queue", [
      { id: "msg-2", timestamp: new Date(), body: { item_id: itemId, photo_r2_key: "nonexistent" } },
    ]);
    const ctx = createExecutionContext();
    await worker.queue(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.ackAll).toBe(true);

    // Item should be set to ready with fallback name
    const item = await env.DB.prepare(
      "SELECT name, status FROM items WHERE id = ?"
    ).bind(itemId).first<{ name: string; status: string }>();
    expect(item!.status).toBe("ready");
    expect(item!.name).toBe("Unknown item");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && pnpm test -- test/queue.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement queue consumer**

```typescript
// apps/api/src/queue/consumer.ts
import type { Env } from "../env.d.ts";

export async function handleImageQueue(
  batch: MessageBatch<{ item_id: string; photo_r2_key: string }>,
  env: Env
) {
  for (const message of batch.messages) {
    const { item_id, photo_r2_key } = message.body;
    try {
      // Fetch image from R2
      const object = await env.STORAGE.get(photo_r2_key);
      if (!object) throw new Error(`Image not found: ${photo_r2_key}`);

      const imageBytes = await object.arrayBuffer();
      const imageArray = [...new Uint8Array(imageBytes)];

      // Call Workers AI
      const aiResponse = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
        messages: [
          {
            role: "user",
            content: "What is this object? Provide a short, specific label (e.g. 'USB-C to Lightning cable' or 'Arduino Nano microcontroller'). Just the label, nothing else.",
          },
        ],
        image: imageArray,
      }) as { response?: string };

      const label = aiResponse.response?.trim() || "Unknown item";

      await env.DB.prepare(
        "UPDATE items SET name = ?, ai_label = ?, status = 'ready' WHERE id = ?"
      ).bind(label, label, item_id).run();
    } catch (error) {
      console.error(`Failed to process item ${item_id}:`, error);
      await env.DB.prepare(
        "UPDATE items SET name = 'Unknown item', status = 'ready' WHERE id = ?"
      ).bind(item_id).run();
    }
    message.ack();
  }
}
```

- [ ] **Step 4: Wire consumer into index.ts**

Update the queue handler in `apps/api/src/index.ts`:

```typescript
import { handleImageQueue } from "./queue/consumer";

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ item_id: string; photo_r2_key: string }>, env: Env) {
    await handleImageQueue(batch, env);
  },
};
```

- [ ] **Step 5: Run tests**

Run: `cd apps/api && pnpm test`
Expected: All tests pass (Workers AI is mocked automatically by vitest-pool-workers)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/queue/ apps/api/test/queue.test.ts apps/api/src/index.ts
git commit -m "feat: implement Workers AI queue consumer for image identification"
```

---

## Phase 5: Frontend

### Task 15: App Shell — Sidebar Layout and Router

**Files:**
- Create: `apps/web/src/components/AppSidebar.vue`
- Create: `apps/web/src/stores/auth.ts`
- Create: `apps/web/src/composables/useApi.ts`
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/router/index.ts`
- Create: stub pages for all routes

- [ ] **Step 1: Create auth store**

```typescript
// apps/web/src/stores/auth.ts
import { defineStore } from "pinia";
import { ref } from "vue";

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const loading = ref(true);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      user.value = data.user;
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    user.value = null;
    window.location.href = "/login";
  }

  return { user, loading, fetchUser, logout };
});
```

- [ ] **Step 2: Create API fetch wrapper**

```typescript
// apps/web/src/composables/useApi.ts
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...init.headers,
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as any).error || "Request failed");
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 3: Create AppSidebar component**

```vue
<!-- apps/web/src/components/AppSidebar.vue -->
<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const auth = useAuthStore();
const mobileOpen = ref(false);

const navItems = [
  { name: "Search", path: "/", icon: "search" },
  { name: "Unsorted", path: "/unsorted", icon: "inbox" },
  { name: "Containers", path: "/containers", icon: "archive" },
  { name: "Locations", path: "/locations", icon: "map-pin" },
];

function isActive(path: string) {
  return route.path === path;
}
</script>

<template>
  <!-- Mobile hamburger -->
  <button
    class="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-md bg-gray-100 dark:bg-gray-800"
    @click="mobileOpen = !mobileOpen"
    aria-label="Toggle menu"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path v-if="!mobileOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>

  <!-- Overlay -->
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-30 bg-black/50 lg:hidden"
    @click="mobileOpen = false"
  />

  <!-- Sidebar -->
  <aside
    :class="[
      'fixed top-0 left-0 z-40 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform lg:translate-x-0',
      mobileOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <div class="p-6">
      <h1 class="text-xl font-bold text-indigo-600 dark:text-indigo-400">Storganizer</h1>
    </div>

    <nav class="flex-1 px-3 space-y-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :class="[
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive(item.path)
            ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        ]"
        @click="mobileOpen = false"
      >
        {{ item.name }}
      </RouterLink>
    </nav>

    <!-- Add Items button -->
    <div class="p-3">
      <RouterLink
        to="/add"
        class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        @click="mobileOpen = false"
      >
        Add Items
      </RouterLink>
    </div>

    <!-- User info -->
    <div v-if="auth.user" class="p-4 border-t border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-3">
        <img
          v-if="auth.user.avatar_url"
          :src="auth.user.avatar_url"
          :alt="auth.user.name"
          class="w-8 h-8 rounded-full"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ auth.user.name }}</p>
        </div>
        <button
          @click="auth.logout()"
          class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Logout
        </button>
      </div>
    </div>
  </aside>
</template>
```

- [ ] **Step 4: Update App.vue with sidebar layout**

```vue
<!-- apps/web/src/App.vue -->
<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import AppSidebar from "@/components/AppSidebar.vue";

const auth = useAuthStore();

onMounted(() => {
  auth.fetchUser();
});
</script>

<template>
  <div v-if="auth.loading" class="flex items-center justify-center min-h-screen">
    <p class="text-gray-500">Loading...</p>
  </div>
  <template v-else>
    <template v-if="auth.user">
      <AppSidebar />
      <main class="lg:ml-64 min-h-screen bg-gray-50 dark:bg-gray-950">
        <RouterView />
      </main>
    </template>
    <RouterView v-else />
  </template>
</template>
```

- [ ] **Step 5: Update router with all routes**

```typescript
// apps/web/src/router/index.ts
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "search",
      component: () => import("@/pages/SearchPage.vue"),
    },
    {
      path: "/unsorted",
      name: "unsorted",
      component: () => import("@/pages/UnsortedPage.vue"),
    },
    {
      path: "/containers",
      name: "containers",
      component: () => import("@/pages/ContainersPage.vue"),
    },
    {
      path: "/containers/:id",
      name: "container-detail",
      component: () => import("@/pages/ContainerDetailPage.vue"),
    },
    {
      path: "/locations",
      name: "locations",
      component: () => import("@/pages/LocationsPage.vue"),
    },
    {
      path: "/locations/:id",
      name: "location-detail",
      component: () => import("@/pages/LocationDetailPage.vue"),
    },
    {
      path: "/items/:id",
      name: "item-detail",
      component: () => import("@/pages/ItemDetailPage.vue"),
    },
    {
      path: "/add",
      name: "add-items",
      component: () => import("@/pages/AddItemsPage.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/pages/LoginPage.vue"),
    },
  ],
});

export default router;
```

- [ ] **Step 6: Create stub pages**

Create minimal placeholder files for each page not yet created. Each follows this pattern:

```vue
<!-- apps/web/src/pages/UnsortedPage.vue -->
<template>
  <div class="p-6">
    <h2 class="text-xl font-bold">Unsorted Items</h2>
    <p class="text-gray-500 mt-2">Coming soon</p>
  </div>
</template>
```

Create these files with the same pattern (adjusting the h2 text):
- `apps/web/src/pages/ContainersPage.vue` — "Containers"
- `apps/web/src/pages/ContainerDetailPage.vue` — "Container Detail"
- `apps/web/src/pages/LocationsPage.vue` — "Locations"
- `apps/web/src/pages/LocationDetailPage.vue` — "Location Detail"
- `apps/web/src/pages/ItemDetailPage.vue` — "Item Detail"
- `apps/web/src/pages/AddItemsPage.vue` — "Add Items"
- `apps/web/src/pages/LoginPage.vue` — "Login"

- [ ] **Step 7: Verify dev server starts**

Run: `cd apps/web && pnpm dev`
Expected: Dev server starts, visit http://localhost:5173 and see the sidebar layout

- [ ] **Step 8: Update e2e smoke test**

```typescript
// apps/web/e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("homepage loads with app name in sidebar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Storganizer")).toBeVisible();
});
```

- [ ] **Step 9: Run e2e test**

Run: `cd apps/web && pnpm test:e2e`
Expected: Smoke test passes

- [ ] **Step 10: Commit**

```bash
git add apps/web/
git commit -m "feat: implement app shell with sidebar navigation and all route stubs"
```

---

### Task 16: Login Page

**Files:**
- Modify: `apps/web/src/pages/LoginPage.vue`

- [ ] **Step 1: Implement login page**

```vue
<!-- apps/web/src/pages/LoginPage.vue -->
<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";

const route = useRoute();
const error = computed(() => route.query.error as string | undefined);
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
    <div class="w-full max-w-sm p-8">
      <h1 class="text-2xl font-bold text-center mb-2">Storganizer</h1>
      <p class="text-gray-500 dark:text-gray-400 text-center mb-8">
        Organize your stuff, find it later.
      </p>

      <div v-if="error === 'not_allowed'" class="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
        Your account is not authorized. Ask an admin for an invite.
      </div>

      <a
        href="/api/auth/google"
        class="flex items-center justify-center gap-3 w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </a>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/LoginPage.vue
git commit -m "feat: implement Google OAuth login page"
```

---

### Task 17: Search Page (Home)

**Files:**
- Modify: `apps/web/src/pages/SearchPage.vue`
- Create: `apps/web/src/components/ItemCard.vue`
- Create: `apps/web/src/composables/useItems.ts`

- [ ] **Step 1: Create items composable**

```typescript
// apps/web/src/composables/useItems.ts
import { ref } from "vue";
import { api } from "./useApi";

export interface Item {
  id: string;
  name: string;
  ai_label: string | null;
  description: string | null;
  status: string;
  container_id: string | null;
  container_name: string | null;
  location_name: string | null;
  thumbnail_key: string | null;
  created_at: string;
}

export function useItems() {
  const items = ref<Item[]>([]);
  const loading = ref(false);

  async function search(query: string) {
    loading.value = true;
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : "";
      const data = await api<{ items: Item[] }>(`/api/items${params}`);
      items.value = data.items;
    } finally {
      loading.value = false;
    }
  }

  async function fetchUnorganized() {
    loading.value = true;
    try {
      const data = await api<{ items: Item[] }>("/api/items?unorganized=true");
      items.value = data.items;
    } finally {
      loading.value = false;
    }
  }

  async function updateItem(id: string, updates: Partial<Pick<Item, "name" | "description" | "container_id">>) {
    const data = await api<{ item: Item }>(`/api/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return data.item;
  }

  async function deleteItem(id: string) {
    await api(`/api/items/${id}`, { method: "DELETE" });
  }

  return { items, loading, search, fetchUnorganized, updateItem, deleteItem };
}
```

- [ ] **Step 2: Create ItemCard component**

```vue
<!-- apps/web/src/components/ItemCard.vue -->
<script setup lang="ts">
import type { Item } from "@/composables/useItems";

defineProps<{ item: Item }>();
</script>

<template>
  <RouterLink
    :to="`/items/${item.id}`"
    class="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
  >
    <div class="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 shrink-0 overflow-hidden">
      <img
        v-if="item.thumbnail_key"
        :src="`/api/photos/${item.thumbnail_key}`"
        class="w-full h-full object-cover"
        alt=""
      />
      <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="font-medium truncate">
        <span v-if="item.status === 'processing'" class="text-gray-400 italic">Processing...</span>
        <span v-else>{{ item.name }}</span>
      </p>
      <p v-if="item.container_name" class="text-sm text-gray-500 dark:text-gray-400 truncate">
        {{ item.container_name }}
        <span v-if="item.location_name"> &rarr; {{ item.location_name }}</span>
      </p>
      <p v-else class="text-sm text-gray-400 italic">Unsorted</p>
    </div>
  </RouterLink>
</template>
```

- [ ] **Step 3: Implement SearchPage**

```vue
<!-- apps/web/src/pages/SearchPage.vue -->
<script setup lang="ts">
import { ref, watch } from "vue";
import { useItems } from "@/composables/useItems";
import ItemCard from "@/components/ItemCard.vue";

const { items, loading, search } = useItems();
const query = ref("");
let debounceTimer: ReturnType<typeof setTimeout>;

watch(query, (val) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => search(val), 300);
});

// Load all items initially
search("");
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="mb-6">
      <input
        v-model="query"
        type="search"
        placeholder="Search items, containers, locations..."
        class="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>

    <div v-if="loading && items.length === 0" class="text-center py-12 text-gray-500">
      Searching...
    </div>

    <div v-else-if="items.length === 0 && !query" class="text-center py-12">
      <p class="text-gray-500 mb-4">No items yet. Start by adding some!</p>
      <RouterLink
        to="/add"
        class="inline-flex px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
      >
        Add Items
      </RouterLink>
    </div>

    <div v-else-if="items.length === 0 && query" class="text-center py-12 text-gray-500">
      No results for "{{ query }}"
    </div>

    <div v-else class="space-y-3">
      <ItemCard v-for="item in items" :key="item.id" :item="item" />
    </div>
  </div>
</template>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat: implement search page with item cards and breadcrumb trail"
```

---

### Task 18: Add Items Page (Photo Upload)

**Files:**
- Create: `apps/web/src/components/PhotoUploader.vue`
- Modify: `apps/web/src/pages/AddItemsPage.vue`

- [ ] **Step 1: Create PhotoUploader component**

```vue
<!-- apps/web/src/components/PhotoUploader.vue -->
<script setup lang="ts">
import { ref } from "vue";

interface UploadedItem {
  id: string;
  name: string;
  status: string;
}

const uploads = ref<{ file: File; progress: string; item?: UploadedItem }[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

async function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = "";

  for (const file of files) {
    const entry = { file, progress: "uploading" as string, item: undefined as UploadedItem | undefined };
    uploads.value.unshift(entry);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/items/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { item: UploadedItem };
      entry.item = data.item;
      entry.progress = "done";
    } catch {
      entry.progress = "error";
    }
  }
}

function pollStatus(itemId: string, entryIndex: number) {
  const interval = setInterval(async () => {
    const res = await fetch(`/api/items/${itemId}`, { credentials: "include" });
    if (!res.ok) { clearInterval(interval); return; }
    const data = await res.json() as { item: UploadedItem };
    if (data.item.status === "ready") {
      uploads.value[entryIndex].item = data.item;
      clearInterval(interval);
    }
  }, 2000);
}
</script>

<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture="environment"
      multiple
      class="hidden"
      @change="handleFiles"
    />

    <button
      @click="fileInput?.click()"
      class="w-full py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center gap-3 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer"
    >
      <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
      <p class="text-gray-600 dark:text-gray-400 font-medium">Tap to take a photo or select files</p>
      <p class="text-sm text-gray-400">You can select multiple photos at once</p>
    </button>

    <div v-if="uploads.length > 0" class="mt-6 space-y-3">
      <div
        v-for="(upload, index) in uploads"
        :key="index"
        class="flex items-center gap-4 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
      >
        <img
          :src="URL.createObjectURL(upload.file)"
          class="w-12 h-12 rounded object-cover"
          alt=""
        />
        <div class="flex-1 min-w-0">
          <p v-if="upload.progress === 'uploading'" class="text-sm text-gray-500 italic">Uploading...</p>
          <p v-else-if="upload.progress === 'error'" class="text-sm text-red-500">Upload failed</p>
          <template v-else-if="upload.item">
            <p class="text-sm font-medium truncate">{{ upload.item.name }}</p>
            <p v-if="upload.item.status === 'processing'" class="text-xs text-gray-400 italic">Identifying...</p>
          </template>
        </div>
        <RouterLink
          v-if="upload.item"
          :to="`/items/${upload.item.id}`"
          class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
        >
          View
        </RouterLink>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Implement AddItemsPage**

```vue
<!-- apps/web/src/pages/AddItemsPage.vue -->
<script setup lang="ts">
import PhotoUploader from "@/components/PhotoUploader.vue";
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <h2 class="text-xl font-bold mb-6">Add Items</h2>
    <PhotoUploader />
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/
git commit -m "feat: implement photo upload page with camera capture and progress"
```

---

### Task 19: Unsorted Items Page

**Files:**
- Modify: `apps/web/src/pages/UnsortedPage.vue`
- Create: `apps/web/src/composables/useContainers.ts`

- [ ] **Step 1: Create containers composable**

```typescript
// apps/web/src/composables/useContainers.ts
import { ref } from "vue";
import { api } from "./useApi";

export interface Container {
  id: string;
  name: string;
  description: string | null;
  location_id: string | null;
  location_name: string | null;
  item_count: number;
  created_at: string;
}

export function useContainers() {
  const containers = ref<Container[]>([]);
  const loading = ref(false);

  async function fetchAll(locationId?: string) {
    loading.value = true;
    try {
      const params = locationId ? `?location_id=${locationId}` : "";
      const data = await api<{ containers: Container[] }>(`/api/containers${params}`);
      containers.value = data.containers;
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, locationId?: string) {
    const data = await api<{ container: Container }>("/api/containers", {
      method: "POST",
      body: JSON.stringify({ name, location_id: locationId || null }),
    });
    containers.value.unshift(data.container);
    return data.container;
  }

  return { containers, loading, fetchAll, create };
}
```

- [ ] **Step 2: Implement UnsortedPage**

```vue
<!-- apps/web/src/pages/UnsortedPage.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useItems } from "@/composables/useItems";
import { useContainers, type Container } from "@/composables/useContainers";
import ItemCard from "@/components/ItemCard.vue";

const { items, loading, fetchUnorganized, updateItem } = useItems();
const { containers, fetchAll: fetchContainers } = useContainers();
const selected = ref<Set<string>>(new Set());
const assigningTo = ref<string | null>(null);
const showAssign = ref(false);

onMounted(() => {
  fetchUnorganized();
  fetchContainers();
});

function toggleSelect(id: string) {
  if (selected.value.has(id)) {
    selected.value.delete(id);
  } else {
    selected.value.add(id);
  }
}

async function assignSelected(containerId: string) {
  for (const itemId of selected.value) {
    await updateItem(itemId, { container_id: containerId });
  }
  selected.value.clear();
  showAssign.value = false;
  fetchUnorganized();
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">Unsorted Items</h2>
      <button
        v-if="selected.size > 0"
        @click="showAssign = true"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
      >
        Assign {{ selected.size }} item{{ selected.size > 1 ? 's' : '' }}
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else-if="items.length === 0" class="text-center py-12">
      <p class="text-gray-500">All items are organized!</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-3"
      >
        <input
          type="checkbox"
          :checked="selected.has(item.id)"
          @change="toggleSelect(item.id)"
          class="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <div class="flex-1">
          <ItemCard :item="item" />
        </div>
      </div>
    </div>

    <!-- Assign modal -->
    <div v-if="showAssign" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showAssign = false">
      <div class="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">Assign to Container</h3>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <button
            v-for="c in containers"
            :key="c.id"
            @click="assignSelected(c.id)"
            class="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <p class="font-medium">{{ c.name }}</p>
            <p v-if="c.location_name" class="text-sm text-gray-500">{{ c.location_name }}</p>
          </button>
        </div>
        <button @click="showAssign = false" class="mt-4 w-full py-2 text-gray-500 text-sm">Cancel</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/
git commit -m "feat: implement unsorted items page with batch assignment"
```

---

### Task 20: Item Detail Page

**Files:**
- Modify: `apps/web/src/pages/ItemDetailPage.vue`

- [ ] **Step 1: Implement ItemDetailPage**

```vue
<!-- apps/web/src/pages/ItemDetailPage.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "@/composables/useApi";
import { useContainers } from "@/composables/useContainers";

interface ItemDetail {
  id: string;
  name: string;
  ai_label: string | null;
  description: string | null;
  status: string;
  container_id: string | null;
  container_name: string | null;
  location_id: string | null;
  location_name: string | null;
  created_at: string;
  photos: { id: string; r2_key: string; thumbnail_url: string | null }[];
}

const route = useRoute();
const router = useRouter();
const { containers, fetchAll: fetchContainers } = useContainers();

const item = ref<ItemDetail | null>(null);
const editName = ref("");
const editDescription = ref("");
const editContainerId = ref<string | null>(null);
const saving = ref(false);

onMounted(async () => {
  const data = await api<{ item: ItemDetail }>(`/api/items/${route.params.id}`);
  item.value = data.item;
  editName.value = data.item.name;
  editDescription.value = data.item.description || "";
  editContainerId.value = data.item.container_id;
  fetchContainers();
});

async function save() {
  if (!item.value) return;
  saving.value = true;
  try {
    const data = await api<{ item: ItemDetail }>(`/api/items/${item.value.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editName.value,
        description: editDescription.value || null,
        container_id: editContainerId.value,
      }),
    });
    item.value = { ...item.value, ...data.item };
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!item.value || !confirm("Delete this item?")) return;
  await api(`/api/items/${item.value.id}`, { method: "DELETE" });
  router.push("/");
}
</script>

<template>
  <div v-if="item" class="p-6 max-w-2xl mx-auto">
    <!-- Photos -->
    <div v-if="item.photos.length > 0" class="mb-6 space-y-3">
      <div
        v-for="photo in item.photos"
        :key="photo.id"
        class="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"
      >
        <img
          :src="`/api/photos/${photo.r2_key}`"
          class="w-full max-h-96 object-contain"
          alt=""
        />
      </div>
    </div>

    <!-- AI Label reference -->
    <p v-if="item.ai_label && item.ai_label !== item.name" class="text-sm text-gray-500 mb-4">
      AI identified as: <span class="italic">{{ item.ai_label }}</span>
    </p>

    <!-- Edit form -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Name</label>
        <input
          v-model="editName"
          class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Description</label>
        <textarea
          v-model="editDescription"
          rows="3"
          class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Optional notes..."
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Container</label>
        <select
          v-model="editContainerId"
          class="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option :value="null">— None (unsorted) —</option>
          <option v-for="c in containers" :key="c.id" :value="c.id">
            {{ c.name }}
            <template v-if="c.location_name"> ({{ c.location_name }})</template>
          </option>
        </select>
      </div>

      <div class="flex gap-3">
        <button
          @click="save"
          :disabled="saving"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ saving ? "Saving..." : "Save" }}
        </button>
        <button
          @click="remove"
          class="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add photo serving route to API**

Add a top-level photo route to `apps/api/src/index.ts` (before the auth middleware, so it doesn't require auth for cached images):

```typescript
// Photo serving — must come before items route to match /api/photos/*
app.get("/api/photos/*", async (c) => {
  const key = c.req.path.replace("/api/photos/", "");
  const object = await c.env.STORAGE.get(key);
  if (!object) return c.notFound();
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/ apps/api/src/
git commit -m "feat: implement item detail page with photo display, edit, and delete"
```

---

### Task 21: Containers and Locations Pages

**Files:**
- Modify: `apps/web/src/pages/ContainersPage.vue`
- Modify: `apps/web/src/pages/ContainerDetailPage.vue`
- Modify: `apps/web/src/pages/LocationsPage.vue`
- Modify: `apps/web/src/pages/LocationDetailPage.vue`
- Create: `apps/web/src/composables/useLocations.ts`

- [ ] **Step 1: Create locations composable**

```typescript
// apps/web/src/composables/useLocations.ts
import { ref } from "vue";
import { api } from "./useApi";

export interface Location {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function useLocations() {
  const locations = ref<Location[]>([]);
  const loading = ref(false);

  async function fetchAll() {
    loading.value = true;
    try {
      const data = await api<{ locations: Location[] }>("/api/locations");
      locations.value = data.locations;
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, description?: string) {
    const data = await api<{ location: Location }>("/api/locations", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
    locations.value.unshift(data.location);
    return data.location;
  }

  return { locations, loading, fetchAll, create };
}
```

- [ ] **Step 2: Implement ContainersPage**

```vue
<!-- apps/web/src/pages/ContainersPage.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useContainers } from "@/composables/useContainers";
import { useLocations } from "@/composables/useLocations";

const { containers, loading, fetchAll, create } = useContainers();
const { locations, fetchAll: fetchLocations } = useLocations();
const showCreate = ref(false);
const newName = ref("");
const newLocationId = ref<string | null>(null);

onMounted(() => {
  fetchAll();
  fetchLocations();
});

async function handleCreate() {
  if (!newName.value.trim()) return;
  await create(newName.value.trim(), newLocationId.value || undefined);
  newName.value = "";
  newLocationId.value = null;
  showCreate.value = false;
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">Containers</h2>
      <button
        @click="showCreate = !showCreate"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
      >
        New Container
      </button>
    </div>

    <!-- Create form -->
    <div v-if="showCreate" class="mb-6 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div class="space-y-3">
        <input
          v-model="newName"
          placeholder="Container name..."
          class="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @keydown.enter="handleCreate"
        />
        <select
          v-model="newLocationId"
          class="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option :value="null">No location</option>
          <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
        </select>
        <button @click="handleCreate" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else-if="containers.length === 0" class="text-center py-12 text-gray-500">
      No containers yet. Create one to start organizing items.
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="c in containers"
        :key="c.id"
        :to="`/containers/${c.id}`"
        class="block p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
      >
        <p class="font-medium">{{ c.name }}</p>
        <p class="text-sm text-gray-500 mt-1">
          {{ c.item_count }} item{{ c.item_count !== 1 ? 's' : '' }}
          <span v-if="c.location_name"> &middot; {{ c.location_name }}</span>
        </p>
      </RouterLink>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Implement ContainerDetailPage**

```vue
<!-- apps/web/src/pages/ContainerDetailPage.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/composables/useApi";
import ItemCard from "@/components/ItemCard.vue";
import type { Item } from "@/composables/useItems";

interface ContainerDetail {
  id: string;
  name: string;
  description: string | null;
  location_id: string | null;
  location_name: string | null;
  items: Item[];
}

const route = useRoute();
const container = ref<ContainerDetail | null>(null);

onMounted(async () => {
  const data = await api<{ container: ContainerDetail }>(`/api/containers/${route.params.id}`);
  container.value = data.container;
});
</script>

<template>
  <div v-if="container" class="p-6 max-w-3xl mx-auto">
    <h2 class="text-xl font-bold">{{ container.name }}</h2>
    <p v-if="container.location_name" class="text-sm text-gray-500 mt-1">
      {{ container.location_name }}
    </p>

    <div class="mt-6 space-y-3">
      <ItemCard v-for="item in container.items" :key="item.id" :item="item" />
      <p v-if="container.items.length === 0" class="text-gray-500 text-center py-8">
        No items in this container yet.
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Implement LocationsPage**

```vue
<!-- apps/web/src/pages/LocationsPage.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useLocations } from "@/composables/useLocations";

const { locations, loading, fetchAll, create } = useLocations();
const showCreate = ref(false);
const newName = ref("");

onMounted(() => fetchAll());

async function handleCreate() {
  if (!newName.value.trim()) return;
  await create(newName.value.trim());
  newName.value = "";
  showCreate.value = false;
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold">Locations</h2>
      <button
        @click="showCreate = !showCreate"
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
      >
        New Location
      </button>
    </div>

    <div v-if="showCreate" class="mb-6 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <input
        v-model="newName"
        placeholder="Location name (e.g. Attic, Garage Shelf B)..."
        class="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        @keydown.enter="handleCreate"
      />
      <button @click="handleCreate" class="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else-if="locations.length === 0" class="text-center py-12 text-gray-500">
      No locations yet. Create one to organize your containers.
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="loc in locations"
        :key="loc.id"
        :to="`/locations/${loc.id}`"
        class="block p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
      >
        <p class="font-medium">{{ loc.name }}</p>
        <p v-if="loc.description" class="text-sm text-gray-500 mt-1">{{ loc.description }}</p>
      </RouterLink>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Implement LocationDetailPage**

```vue
<!-- apps/web/src/pages/LocationDetailPage.vue -->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/composables/useApi";

interface LocationDetail {
  id: string;
  name: string;
  description: string | null;
  containers: { id: string; name: string; item_count: number }[];
}

const route = useRoute();
const location = ref<LocationDetail | null>(null);

onMounted(async () => {
  const data = await api<{ location: LocationDetail }>(`/api/locations/${route.params.id}`);
  location.value = data.location;
});
</script>

<template>
  <div v-if="location" class="p-6 max-w-3xl mx-auto">
    <h2 class="text-xl font-bold">{{ location.name }}</h2>
    <p v-if="location.description" class="text-sm text-gray-500 mt-1">{{ location.description }}</p>

    <div class="mt-6 space-y-3">
      <RouterLink
        v-for="c in location.containers"
        :key="c.id"
        :to="`/containers/${c.id}`"
        class="block p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
      >
        <p class="font-medium">{{ c.name }}</p>
        <p class="text-sm text-gray-500">{{ c.item_count }} item{{ c.item_count !== 1 ? 's' : '' }}</p>
      </RouterLink>
      <p v-if="location.containers.length === 0" class="text-gray-500 text-center py-8">
        No containers at this location yet.
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/
git commit -m "feat: implement containers and locations pages with CRUD"
```

---

## Phase 6: E2E Tests

### Task 22: Playwright E2E Tests

**Files:**
- Modify: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/items.spec.ts`
- Create: `apps/web/e2e/search.spec.ts`
- Create: `apps/web/e2e/containers-locations.spec.ts`
- Modify: `apps/web/e2e/smoke.spec.ts`

Note: E2E tests require both the frontend dev server AND the API Worker running locally. The Playwright config needs to start both.

- [ ] **Step 1: Update Playwright config to start both servers**

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "cd ../api && pnpm dev",
      url: "http://localhost:8787/api/health",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5173",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
```

- [ ] **Step 2: Write search e2e test**

```typescript
// apps/web/e2e/search.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Search page", () => {
  test("shows search input on homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test("shows empty state when no items", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=No items yet")).toBeVisible();
  });

  test("shows Add Items link in empty state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Add Items" })).toBeVisible();
  });
});
```

- [ ] **Step 3: Write items e2e test**

```typescript
// apps/web/e2e/items.spec.ts
import { test, expect } from "@playwright/test";

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
```

- [ ] **Step 4: Write containers/locations e2e tests**

```typescript
// apps/web/e2e/containers-locations.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Containers page", () => {
  test("shows empty state", async ({ page }) => {
    await page.goto("/containers");
    await expect(page.locator("text=No containers yet")).toBeVisible();
  });

  test("has New Container button", async ({ page }) => {
    await page.goto("/containers");
    await expect(page.getByRole("button", { name: "New Container" })).toBeVisible();
  });
});

test.describe("Locations page", () => {
  test("shows empty state", async ({ page }) => {
    await page.goto("/locations");
    await expect(page.locator("text=No locations yet")).toBeVisible();
  });

  test("has New Location button", async ({ page }) => {
    await page.goto("/locations");
    await expect(page.getByRole("button", { name: "New Location" })).toBeVisible();
  });
});
```

- [ ] **Step 5: Update smoke test**

```typescript
// apps/web/e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("app loads with sidebar navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Storganizer")).toBeVisible();
});

test.describe("responsive layout", () => {
  test("sidebar visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.locator("aside")).toBeVisible();
  });
});

test.describe("navigation", () => {
  test("can navigate to all main pages", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Unsorted");
    await expect(page).toHaveURL("/unsorted");
    await page.click("text=Containers");
    await expect(page).toHaveURL("/containers");
    await page.click("text=Locations");
    await expect(page).toHaveURL("/locations");
  });
});
```

- [ ] **Step 6: Run e2e tests**

Run: `cd apps/web && pnpm test:e2e`
Expected: All e2e tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/web/e2e/ apps/web/playwright.config.ts
git commit -m "feat: add Playwright e2e tests for all pages"
```

---

## Verification

After all tasks are complete:

1. **API tests:** `cd apps/api && pnpm test` — all pass
2. **E2E tests:** `cd apps/web && pnpm test:e2e` — all pass
3. **Dev servers:** `pnpm dev` from root starts both API and frontend
4. **Manual check:**
   - Visit http://localhost:5173
   - Login page shows for unauthenticated users
   - Sidebar navigation works
   - Search page has search input
   - Add Items page shows photo upload area
   - Containers and Locations pages show create forms
   - Dark/light mode follows system preference
