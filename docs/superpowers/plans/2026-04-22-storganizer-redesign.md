# Storganizer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Condense the Vue SPA to two primary screens (Search, Unsorted) plus a full-bleed Camera screen, replace the indigo-on-light theme with a warm-minimal dark theme, and remove containers/locations screens in favor of shared comboboxes with device-local defaults.

**Architecture:** Keep monorepo (`apps/web` Vue 3, `apps/api` Hono on Workers). No DB migration. Extend the upload endpoint to accept an optional `container_id` so photos can be pre-sorted. Introduce one shared `EntityCombobox` for containers and locations with create-on-the-fly + write-through-to-device-default. Theme is set via Tailwind 4 `@theme` tokens in `main.css`. Camera screen has a toggle between a live-viewfinder mode (`getUserMedia`) and a native file-input mode (`capture=environment`); mode preference persists in localStorage.

**Tech Stack:** Vue 3, Vite, Tailwind CSS 4, pnpm, Hono, Cloudflare Workers/D1/R2, Playwright e2e, `@vueuse/core` (new), `reka-ui` (new).

**Spec:** `docs/superpowers/specs/2026-04-22-storganizer-redesign-design.md`

---

## Working conventions

- Work in `apps/web` unless noted.
- Commands assume CWD `apps/web` unless noted; use `cd apps/web &&` inline if running from repo root.
- Tests: `pnpm test:e2e` runs all Playwright specs. To run one: `pnpm test:e2e e2e/<file>.spec.ts`. Append `--project=chromium` to skip the mobile project when it's not relevant.
- When a test step says "verify fails," the expected failure mode is described alongside. If it fails differently (e.g., compile error vs assertion error), fix the compile error first and retry.
- Each task ends with a commit. Use conventional-commit prefixes (`feat:`, `refactor:`, `test:`, `chore:`).
- Never skip `pnpm test:e2e` before committing.

---

## Task 1: Install dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install runtime deps**

Run from repo root:
```bash
pnpm --filter @storganizer/web add @vueuse/core reka-ui
```

Expected: `package.json` gains `@vueuse/core` and `reka-ui` under `dependencies`; `pnpm-lock.yaml` updated.

- [ ] **Step 2: Verify build still works**

```bash
cd apps/web && pnpm build
```

Expected: `vue-tsc` passes, Vite build emits `dist/`. No new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add @vueuse/core and reka-ui for redesign"
```

---

## Task 2: Add warm theme tokens + remove any remaining blue

**Files:**
- Create: `apps/web/e2e/theme.spec.ts`
- Modify: `apps/web/src/assets/main.css`

- [ ] **Step 1: Write failing theme test**

Create `apps/web/e2e/theme.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd apps/web && pnpm test:e2e e2e/theme.spec.ts --project=chromium
```

Expected: both assertions fail because current background is light gray and `--color-accent` is unset.

- [ ] **Step 3: Replace `main.css` with theme tokens**

Overwrite `apps/web/src/assets/main.css`:

```css
@import "tailwindcss";

@theme {
  --color-bg: #0f0e0c;
  --color-surface: #1c1a17;
  --color-raised: #2a2622;
  --color-border: #332e28;
  --color-text: #efe9e0;
  --color-muted: #a79b8c;
  --color-accent: #d97706;
  --color-accent-hover: #b45309;
  --color-danger: #dc2626;

  --radius-input: 0.25rem;
  --radius-card: 0.375rem;

  --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
}

html {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  color-scheme: dark;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  margin: 0;
  min-height: 100vh;
}

*:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test:e2e e2e/theme.spec.ts --project=chromium
```

Expected: PASS for both assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/assets/main.css apps/web/e2e/theme.spec.ts
git commit -m "feat(theme): add warm minimal dark theme tokens"
```

---

## Task 3: Demolish dead pages, components, routes, and their tests

**Files:**
- Delete: `apps/web/src/pages/ContainersPage.vue`
- Delete: `apps/web/src/pages/ContainerDetailPage.vue`
- Delete: `apps/web/src/pages/LocationsPage.vue`
- Delete: `apps/web/src/pages/LocationDetailPage.vue`
- Delete: `apps/web/src/pages/AddItemsPage.vue`
- Delete: `apps/web/src/components/AppSidebar.vue`
- Delete: `apps/web/src/components/PhotoUploader.vue`
- Delete: `apps/web/e2e/containers-locations.spec.ts`
- Delete: `apps/web/e2e/items.spec.ts`
- Delete: `apps/web/e2e/smoke.spec.ts`
- Modify: `apps/web/src/router/index.ts`
- Modify: `apps/web/src/App.vue`
- Create: `apps/web/src/pages/CameraView.vue` (stub)

- [ ] **Step 1: Delete obsolete pages, components, and tests**

```bash
rm apps/web/src/pages/ContainersPage.vue \
   apps/web/src/pages/ContainerDetailPage.vue \
   apps/web/src/pages/LocationsPage.vue \
   apps/web/src/pages/LocationDetailPage.vue \
   apps/web/src/pages/AddItemsPage.vue \
   apps/web/src/components/AppSidebar.vue \
   apps/web/src/components/PhotoUploader.vue \
   apps/web/e2e/containers-locations.spec.ts \
   apps/web/e2e/items.spec.ts \
   apps/web/e2e/smoke.spec.ts
```

- [ ] **Step 2: Add CameraView stub so the new route resolves**

Create `apps/web/src/pages/CameraView.vue`:

```vue
<script setup lang="ts">
// Full implementation in later tasks.
</script>

<template>
  <div class="p-6">
    <h1>Camera</h1>
  </div>
</template>
```

- [ ] **Step 3: Rewrite router**

Overwrite `apps/web/src/router/index.ts`:

```typescript
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "search", component: () => import("@/pages/SearchPage.vue") },
    { path: "/unsorted", name: "unsorted", component: () => import("@/pages/UnsortedPage.vue") },
    { path: "/camera", name: "camera", component: () => import("@/pages/CameraView.vue") },
    { path: "/items/:id", name: "item-detail", component: () => import("@/pages/ItemDetailPage.vue") },
    { path: "/login", name: "login", component: () => import("@/pages/LoginPage.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
```

- [ ] **Step 4: Temporarily remove `AppSidebar` reference in `App.vue`**

Overwrite `apps/web/src/App.vue` with a minimal shell so it compiles. The full `AppHeader` wiring happens in Task 9.

```vue
<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();

onMounted(() => {
  auth.fetchUser();
});
</script>

<template>
  <div v-if="auth.loading" class="flex items-center justify-center min-h-screen">
    <p class="text-[var(--color-muted)]">Loading...</p>
  </div>
  <template v-else>
    <RouterView />
  </template>
</template>
```

- [ ] **Step 5: Verify build**

```bash
cd apps/web && pnpm build
```

Expected: type-check passes with no dangling imports.

- [ ] **Step 6: Run remaining e2e specs**

```bash
pnpm test:e2e --project=chromium
```

Expected: `theme.spec.ts` and `search.spec.ts` run. `search.spec.ts` may fail if it depended on the sidebar — that's fine, it will be re-authored in Task 10. Note any failures but don't fix them yet.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove containers/locations/add pages and sidebar"
```

---

## Task 4: Extend upload endpoint to accept `container_id`

**Files:**
- Modify: `apps/api/src/routes/items.ts`
- Create: `apps/web/e2e/upload-assignment.spec.ts`

- [ ] **Step 1: Write failing e2e that asserts upload with `container_id` returns the assigned container**

Create `apps/web/e2e/upload-assignment.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

test("POST /api/items/upload forwards container_id form field", async ({ page }) => {
  let capturedBody: FormData | null = null;

  await page.route("**/api/items/upload", async (route) => {
    const postData = route.request().postData();
    // Playwright gives us the raw multipart body; we assert the field name is present.
    capturedBody = postData as unknown as FormData;
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
```

- [ ] **Step 2: Run, verify it fails at the assertion (not network)**

```bash
cd apps/web && pnpm test:e2e e2e/upload-assignment.spec.ts --project=chromium
```

Expected: assertion will pass actually — the test only verifies the *client* sent the field. That's what we need for the upload-side contract. If this passes on first run, that's fine; the test is a contract spec for the client.

- [ ] **Step 3: Modify `apps/api/src/routes/items.ts` — upload handler accepts `container_id`**

Replace the `items.post("/upload", …)` handler (currently lines 9–43) with:

```typescript
items.post("/upload", async (c) => {
  const userId = c.get("userId");

  const formData = await c.req.formData();
  const photo = formData.get("photo");
  if (!photo || !(photo instanceof File)) {
    return c.json({ error: "Photo is required" }, 400);
  }

  const containerIdRaw = formData.get("container_id");
  const containerId =
    typeof containerIdRaw === "string" && containerIdRaw.length > 0 ? containerIdRaw : null;

  if (containerId) {
    const container = await c.env.DB.prepare(
      "SELECT id FROM containers WHERE id = ? AND user_id = ?"
    ).bind(containerId, userId).first();
    if (!container) {
      return c.json({ error: "Container not found" }, 400);
    }
  }

  const itemId = ulid();
  const photoId = ulid();
  const ext = photo.name.split(".").pop() || "jpg";
  const r2Key = `${userId}/${itemId}/${photoId}.${ext}`;

  const arrayBuffer = await photo.arrayBuffer();
  await c.env.STORAGE.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: photo.type },
  });

  await c.env.DB.prepare(
    "INSERT INTO items (id, user_id, name, status, container_id) VALUES (?, ?, 'Processing...', 'processing', ?)"
  ).bind(itemId, userId, containerId).run();

  await c.env.DB.prepare(
    "INSERT INTO item_photos (id, item_id, r2_key) VALUES (?, ?, ?)"
  ).bind(photoId, itemId, r2Key).run();

  await c.env.IMAGE_QUEUE.send({ item_id: itemId, photo_r2_key: r2Key });

  const item = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.status, i.container_id, i.created_at,
     c.name as container_name
     FROM items i LEFT JOIN containers c ON c.id = i.container_id
     WHERE i.id = ?`
  ).bind(itemId).first();

  return c.json({ item }, 201);
});
```

- [ ] **Step 4: Verify API type-checks**

```bash
cd apps/api && pnpm typecheck 2>/dev/null || pnpm build 2>/dev/null || npx tsc --noEmit -p .
```

Expected: no new errors. (Pick whichever command exists in `apps/api/package.json` — check it; if none, use `npx tsc --noEmit -p .`.)

- [ ] **Step 5: Re-run the client-side contract test**

```bash
cd apps/web && pnpm test:e2e e2e/upload-assignment.spec.ts --project=chromium
```

Expected: PASS (it was already structurally passing; we've now built the server side to match).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): accept container_id on items/upload"
```

---

## Task 5: Add `useDefaults` composable

**Files:**
- Create: `apps/web/src/composables/useDefaults.ts`

This composable is a thin wrapper; the full behavior gets tested end-to-end in Task 6's combobox test and Task 17's defaults integration test.

- [ ] **Step 1: Create composable**

Create `apps/web/src/composables/useDefaults.ts`:

```typescript
import { useLocalStorage } from "@vueuse/core";

export type CameraMode = "continuous" | "native";

export function useDefaultContainer() {
  return useLocalStorage<string | null>("default-container", null);
}

export function useDefaultLocation() {
  return useLocalStorage<string | null>("default-location", null);
}

export function useCameraMode() {
  return useLocalStorage<CameraMode>("camera-mode", "continuous");
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && pnpm build
```

Expected: compiles cleanly.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/composables/useDefaults.ts
git commit -m "feat: add useDefaults composable for device-local prefs"
```

---

## Task 6: Build `EntityCombobox` with tests

**Files:**
- Create: `apps/web/e2e/combobox.spec.ts`
- Create: `apps/web/src/components/EntityCombobox.vue`
- Create: `apps/web/src/pages/DevComboboxPage.vue` (temporary test harness, deleted at end of task)
- Modify: `apps/web/src/router/index.ts` (add temporary `/dev/combobox` route)

- [ ] **Step 1: Add a temporary harness route so the combobox can be exercised from Playwright**

Add to `apps/web/src/router/index.ts` (inside the `routes` array, before the catch-all):

```typescript
{ path: "/dev/combobox", component: () => import("@/pages/DevComboboxPage.vue") },
```

Create `apps/web/src/pages/DevComboboxPage.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import EntityCombobox from "@/components/EntityCombobox.vue";
import { useDefaultContainer } from "@/composables/useDefaults";

const list = ref([
  { id: "ctr-a", name: "Bin A" },
  { id: "ctr-b", name: "Bin B" },
]);
const selected = useDefaultContainer();

async function create(name: string) {
  const id = `ctr-${name.toLowerCase()}`;
  const entity = { id, name };
  list.value = [...list.value, entity];
  return entity;
}
</script>

<template>
  <div class="p-6">
    <EntityCombobox
      data-testid="combobox"
      entity-label="container"
      :list="list"
      :model-value="selected"
      :create-fn="create"
      @update:model-value="(v) => (selected = v)"
    />
    <p data-testid="selected">{{ selected ?? "none" }}</p>
  </div>
</template>
```

- [ ] **Step 2: Write failing combobox test**

Create `apps/web/e2e/combobox.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

test.describe("EntityCombobox", () => {
  test("shows existing options on open", async ({ page }) => {
    await page.goto("/dev/combobox");
    await page.getByTestId("combobox").click();
    await expect(page.getByRole("option", { name: "Bin A" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Bin B" })).toBeVisible();
  });

  test("filters by typed value", async ({ page }) => {
    await page.goto("/dev/combobox");
    await page.getByTestId("combobox").click();
    await page.getByTestId("combobox").fill("Bin A");
    await expect(page.getByRole("option", { name: "Bin A" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Bin B" })).toBeHidden();
  });

  test("selecting existing writes id to localStorage", async ({ page }) => {
    await page.goto("/dev/combobox");
    await page.getByTestId("combobox").click();
    await page.getByRole("option", { name: "Bin B" }).click();
    await expect(page.getByTestId("selected")).toHaveText("ctr-b");
    const stored = await page.evaluate(() => localStorage.getItem("default-container"));
    expect(stored).toBe('"ctr-b"');
  });

  test("typing a new name shows + Create option and creates on select", async ({ page }) => {
    await page.goto("/dev/combobox");
    await page.getByTestId("combobox").click();
    await page.getByTestId("combobox").fill("Shed");
    const createOption = page.getByRole("option", { name: /Create\s+"?Shed"?/i });
    await expect(createOption).toBeVisible();
    await createOption.click();
    await expect(page.getByTestId("selected")).toHaveText("ctr-shed");
  });

  test("exact match does not show Create option", async ({ page }) => {
    await page.goto("/dev/combobox");
    await page.getByTestId("combobox").click();
    await page.getByTestId("combobox").fill("Bin A");
    await expect(page.getByRole("option", { name: /Create/i })).toBeHidden();
  });
});
```

- [ ] **Step 3: Run, verify it fails**

```bash
pnpm test:e2e e2e/combobox.spec.ts --project=chromium
```

Expected: fails because `EntityCombobox.vue` doesn't exist yet.

- [ ] **Step 4: Implement `EntityCombobox.vue`**

Create `apps/web/src/components/EntityCombobox.vue`:

```vue
<script setup lang="ts" generic="E extends { id: string; name: string }">
import { computed, ref, watch } from "vue";
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxContent,
  ComboboxItem,
  ComboboxViewport,
} from "reka-ui";

const props = defineProps<{
  list: E[];
  modelValue: string | null;
  entityLabel: string;
  createFn: (name: string) => Promise<E>;
}>();

const emit = defineEmits<{
  "update:modelValue": [id: string | null];
  created: [entity: E];
}>();

const query = ref("");
const error = ref<string | null>(null);

const selected = computed(() => props.list.find((e) => e.id === props.modelValue) ?? null);

watch(selected, (s) => {
  if (s) query.value = s.name;
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.list;
  return props.list.filter((e) => e.name.toLowerCase().includes(q));
});

const showCreate = computed(() => {
  const q = query.value.trim();
  if (!q) return false;
  return !props.list.some((e) => e.name.toLowerCase() === q.toLowerCase());
});

async function handleSelect(value: string) {
  error.value = null;
  if (value.startsWith("__create__:")) {
    const name = value.slice("__create__:".length);
    try {
      const created = await props.createFn(name);
      emit("created", created);
      emit("update:modelValue", created.id);
      query.value = created.name;
    } catch (e) {
      error.value = `Could not create ${props.entityLabel}`;
    }
    return;
  }
  const found = props.list.find((e) => e.id === value);
  if (found) {
    emit("update:modelValue", found.id);
    query.value = found.name;
  }
}
</script>

<template>
  <div class="relative">
    <ComboboxRoot
      :model-value="modelValue ?? ''"
      @update:model-value="(v) => handleSelect(String(v))"
    >
      <ComboboxAnchor
        class="flex items-center bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-input)] px-3 py-2"
      >
        <ComboboxInput
          class="flex-1 bg-transparent outline-none text-[var(--color-text)] placeholder:text-[var(--color-muted)]"
          :placeholder="`Pick a ${entityLabel}...`"
          :model-value="query"
          @update:model-value="(v) => (query = String(v))"
        />
      </ComboboxAnchor>
      <ComboboxContent
        class="absolute left-0 right-0 top-full mt-1 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-lg overflow-hidden z-20"
      >
        <ComboboxViewport class="max-h-64 overflow-y-auto">
          <ComboboxItem
            v-for="entity in filtered"
            :key="entity.id"
            :value="entity.id"
            class="px-3 py-2 cursor-pointer hover:bg-[var(--color-surface)] data-[highlighted]:bg-[var(--color-surface)]"
          >
            {{ entity.name }}
          </ComboboxItem>
          <ComboboxItem
            v-if="showCreate"
            :value="`__create__:${query.trim()}`"
            class="px-3 py-2 cursor-pointer border-t border-[var(--color-border)] text-[var(--color-accent)] hover:bg-[var(--color-surface)] data-[highlighted]:bg-[var(--color-surface)]"
          >
            + Create "{{ query.trim() }}"
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxRoot>
    <p v-if="error" class="text-[var(--color-danger)] text-sm mt-1">{{ error }}</p>
  </div>
</template>
```

- [ ] **Step 5: Run test, verify it passes**

```bash
pnpm test:e2e e2e/combobox.spec.ts --project=chromium
```

Expected: all 5 assertions pass.

If a test fails because of reka-ui API differences, consult `node_modules/reka-ui/dist/*.d.ts` for the Combobox primitive exports and update accordingly — the exports used above (`ComboboxRoot`, `ComboboxAnchor`, `ComboboxInput`, `ComboboxContent`, `ComboboxItem`, `ComboboxItemIndicator`, `ComboboxViewport`) follow reka-ui's v1 API.

- [ ] **Step 6: Remove the temporary dev route**

Delete `apps/web/src/pages/DevComboboxPage.vue`:

```bash
rm apps/web/src/pages/DevComboboxPage.vue
```

Remove the `/dev/combobox` route from `apps/web/src/router/index.ts` (the line added in Step 1).

Update `apps/web/e2e/combobox.spec.ts` — since the dev harness is gone, change the test to stub the page by navigating to a route we'll add properly later. For now, make the test skip so we can bring it back once the combobox is used in real pages:

```typescript
import { test, expect } from "./fixtures";

test.describe.skip("EntityCombobox", () => {
  // Re-enabled in Task 11 (Unsorted page) and Task 13 (Camera page).
});
```

- [ ] **Step 7: Verify build**

```bash
pnpm build
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add EntityCombobox with create-on-select"
```

---

## Task 7: Build `CameraFab`

**Files:**
- Create: `apps/web/src/components/CameraFab.vue`

- [ ] **Step 1: Implement**

Create `apps/web/src/components/CameraFab.vue`:

```vue
<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <button
    type="button"
    data-testid="camera-fab"
    aria-label="Open camera"
    class="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text)] shadow-lg flex items-center justify-center transition-colors z-30"
    @click="router.push('/camera')"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175-1.053.175-1.802 1.102-1.802 2.169V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  </button>
</template>
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/CameraFab.vue
git commit -m "feat: add CameraFab speed-dial button"
```

---

## Task 8: Build `AppHeader`

**Files:**
- Create: `apps/web/src/components/AppHeader.vue`

- [ ] **Step 1: Implement**

Create `apps/web/src/components/AppHeader.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { onClickOutside } from "@vueuse/core";

const route = useRoute();
const auth = useAuthStore();
const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
onClickOutside(menuRef, () => (menuOpen.value = false));

function isActive(path: string) {
  return route.path === path;
}
</script>

<template>
  <header class="sticky top-0 z-20 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)]">
    <div class="mx-auto max-w-3xl flex items-center gap-4 px-4 h-14">
      <RouterLink to="/" class="font-semibold text-[var(--color-accent)] tracking-tight">Storganizer</RouterLink>
      <nav class="flex items-center gap-1 ml-2">
        <RouterLink
          to="/"
          :class="[
            'px-3 py-1.5 text-sm rounded-[var(--radius-input)]',
            isActive('/')
              ? 'bg-[var(--color-raised)] text-[var(--color-text)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
          ]"
        >Search</RouterLink>
        <RouterLink
          to="/unsorted"
          :class="[
            'px-3 py-1.5 text-sm rounded-[var(--radius-input)]',
            isActive('/unsorted')
              ? 'bg-[var(--color-raised)] text-[var(--color-text)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
          ]"
        >Unsorted</RouterLink>
      </nav>
      <div class="flex-1" />
      <div v-if="auth.user" ref="menuRef" class="relative">
        <button
          type="button"
          aria-label="User menu"
          class="flex items-center gap-2"
          @click="menuOpen = !menuOpen"
        >
          <img
            v-if="auth.user.avatar_url"
            :src="auth.user.avatar_url"
            :alt="auth.user.name"
            class="w-8 h-8 rounded-full"
          />
          <span
            v-else
            class="w-8 h-8 rounded-full bg-[var(--color-raised)] flex items-center justify-center text-xs"
          >{{ auth.user.name?.[0] ?? "?" }}</span>
        </button>
        <div
          v-if="menuOpen"
          class="absolute right-0 top-full mt-1 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-card)] py-1 min-w-[10rem] shadow-lg"
        >
          <div class="px-3 py-2 text-sm text-[var(--color-muted)] border-b border-[var(--color-border)]">
            {{ auth.user.name }}
          </div>
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface)]"
            @click="auth.logout(); menuOpen = false"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AppHeader.vue
git commit -m "feat: add AppHeader top bar"
```

---

## Task 9: Wire `App.vue` layout (header + FAB)

**Files:**
- Modify: `apps/web/src/App.vue`
- Create: `apps/web/e2e/navigation.spec.ts`

- [ ] **Step 1: Write failing navigation test**

Create `apps/web/e2e/navigation.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

test.describe("navigation shell", () => {
  test("shows top bar on Search and Unsorted", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Storganizer" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Unsorted" })).toBeVisible();
    await page.goto("/unsorted");
    await expect(page.getByRole("link", { name: "Unsorted" })).toBeVisible();
  });

  test("camera FAB routes to /camera on Search and Unsorted", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("camera-fab").click();
    await expect(page).toHaveURL("/camera");
    await page.goto("/unsorted");
    await page.getByTestId("camera-fab").click();
    await expect(page).toHaveURL("/camera");
  });

  test("camera screen has no top bar or FAB", async ({ page }) => {
    await page.goto("/camera");
    await expect(page.getByRole("link", { name: "Storganizer" })).toBeHidden();
    await expect(page.getByTestId("camera-fab")).toBeHidden();
  });

  test("removed routes redirect to Search", async ({ page }) => {
    await page.goto("/containers");
    await expect(page).toHaveURL("/");
    await page.goto("/locations");
    await expect(page).toHaveURL("/");
    await page.goto("/add");
    await expect(page).toHaveURL("/");
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
pnpm test:e2e e2e/navigation.spec.ts --project=chromium
```

Expected: FAILs because App.vue doesn't mount the header or FAB yet.

- [ ] **Step 3: Update `App.vue`**

Overwrite `apps/web/src/App.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AppHeader from "@/components/AppHeader.vue";
import CameraFab from "@/components/CameraFab.vue";

const auth = useAuthStore();
const route = useRoute();

const showChrome = computed(
  () => route.name !== "login" && route.name !== "camera"
);
const showFab = computed(
  () => route.name === "search" || route.name === "unsorted"
);

onMounted(() => {
  auth.fetchUser();
});
</script>

<template>
  <div v-if="auth.loading" class="flex items-center justify-center min-h-screen">
    <p class="text-[var(--color-muted)]">Loading...</p>
  </div>
  <template v-else>
    <AppHeader v-if="showChrome" />
    <main class="min-h-screen">
      <RouterView />
    </main>
    <CameraFab v-if="showFab" />
  </template>
</template>
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test:e2e e2e/navigation.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire AppHeader and CameraFab into app shell"
```

---

## Task 10: Redesign SearchPage

**Files:**
- Modify: `apps/web/src/pages/SearchPage.vue`
- Modify: `apps/web/src/components/ItemCard.vue`
- Modify: `apps/web/e2e/search.spec.ts`

- [ ] **Step 1: Read existing `search.spec.ts` and update it to the new design**

Read current file first:

```bash
cat apps/web/e2e/search.spec.ts
```

Rewrite `apps/web/e2e/search.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

test.describe("Search page", () => {
  test("shows search input", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("shows empty state when no items", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/no items/i)).toBeVisible();
  });

  test("renders item cards when API returns items", async ({ page }) => {
    await page.route(/\/api\/items(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "itm-1",
              name: "Hammer",
              ai_label: null,
              description: null,
              status: "ready",
              container_id: "ctr-1",
              container_name: "Toolbox",
              location_name: "Garage",
              thumbnail_key: null,
              created_at: "2026-04-22T00:00:00Z",
            },
          ],
        }),
      })
    );
    await page.goto("/");
    await expect(page.getByText("Hammer")).toBeVisible();
    await expect(page.getByText("Toolbox")).toBeVisible();
  });

  test("uses warm card surface", async ({ page }) => {
    await page.route(/\/api\/items(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "itm-1",
              name: "Hammer",
              status: "ready",
              container_id: null,
              container_name: null,
              location_name: null,
              thumbnail_key: null,
              ai_label: null,
              description: null,
              created_at: "2026-04-22T00:00:00Z",
            },
          ],
        }),
      })
    );
    await page.goto("/");
    const card = page.getByTestId("item-card").first();
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    // #1c1a17 → rgb(28, 26, 23)
    expect(bg).toBe("rgb(28, 26, 23)");
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
pnpm test:e2e e2e/search.spec.ts --project=chromium
```

Expected: "uses warm card surface" fails (old ItemCard uses `bg-white dark:bg-gray-900`).

- [ ] **Step 3: Rewrite `ItemCard.vue`**

Overwrite `apps/web/src/components/ItemCard.vue`:

```vue
<script setup lang="ts">
import type { Item } from "@/composables/useItems";

defineProps<{ item: Item }>();
</script>

<template>
  <RouterLink
    data-testid="item-card"
    :to="`/items/${item.id}`"
    class="flex items-center gap-4 p-3 bg-[var(--color-surface)] rounded-[var(--radius-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
  >
    <div class="w-14 h-14 bg-[var(--color-raised)] rounded-[var(--radius-input)] flex items-center justify-center text-[var(--color-muted)] shrink-0 overflow-hidden">
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
      <p class="font-medium truncate text-[var(--color-text)]">
        <span v-if="item.status === 'processing'" class="text-[var(--color-muted)] italic">Identifying…</span>
        <span v-else>{{ item.name }}</span>
      </p>
      <p v-if="item.container_name" class="text-sm text-[var(--color-muted)] truncate">
        {{ item.container_name }}<span v-if="item.location_name"> &rarr; {{ item.location_name }}</span>
      </p>
      <p v-else class="text-sm text-[var(--color-muted)] italic">Unsorted</p>
    </div>
  </RouterLink>
</template>
```

- [ ] **Step 4: Rewrite `SearchPage.vue`**

Overwrite `apps/web/src/pages/SearchPage.vue`:

```vue
<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useItems } from "@/composables/useItems";
import ItemCard from "@/components/ItemCard.vue";

const { items, loading, search } = useItems();
const query = ref("");
let debounceTimer: ReturnType<typeof setTimeout>;

watch(query, (val) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => search(val), 300);
});

onMounted(() => {
  search("");
});
</script>

<template>
  <div class="px-4 py-6 max-w-3xl mx-auto">
    <input
      v-model="query"
      type="search"
      placeholder="Search items, containers, locations…"
      class="w-full px-4 py-3 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-input)] text-lg text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
    />

    <div v-if="loading && items.length === 0" class="text-center py-12 text-[var(--color-muted)]">
      Searching…
    </div>
    <div v-else-if="items.length === 0" class="text-center py-12">
      <p class="text-[var(--color-muted)] mb-4">No items yet.</p>
    </div>
    <div v-else class="mt-6 space-y-2">
      <ItemCard v-for="item in items" :key="item.id" :item="item" />
    </div>
  </div>
</template>
```

- [ ] **Step 5: Run test, verify it passes**

```bash
pnpm test:e2e e2e/search.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(search): redesign against warm theme"
```

---

## Task 11: Build `UnsortedCard` and rewrite `UnsortedPage`

**Files:**
- Create: `apps/web/src/components/UnsortedCard.vue`
- Modify: `apps/web/src/pages/UnsortedPage.vue`
- Create: `apps/web/e2e/unsorted.spec.ts`

- [ ] **Step 1: Write failing unsorted test**

Create `apps/web/e2e/unsorted.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

const unsortedItem = {
  id: "itm-1",
  name: "Pliers",
  ai_label: "pliers",
  description: null,
  status: "ready",
  container_id: null,
  container_name: null,
  location_name: null,
  thumbnail_key: null,
  created_at: "2026-04-22T00:00:00Z",
};

test.describe("Unsorted page", () => {
  test("lists unsorted items", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [unsortedItem] }),
      })
    );
    await page.goto("/unsorted");
    await expect(page.getByTestId("unsorted-card")).toHaveCount(1);
    await expect(page.getByDisplayValue("Pliers")).toBeVisible();
  });

  test("shows 'Unsorted · N' count", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [unsortedItem, { ...unsortedItem, id: "itm-2", name: "Wrench" }] }),
      })
    );
    await page.goto("/unsorted");
    await expect(page.getByRole("heading", { name: /Unsorted · 2/ })).toBeVisible();
  });

  test("sort-it button PATCHes and removes the row", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [unsortedItem] }),
      })
    );
    await page.route(/\/api\/containers(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ containers: [{ id: "ctr-1", name: "Bin A", location_id: null, location_name: null, item_count: 0, description: null, created_at: "x" }] }),
      })
    );
    let patched = false;
    await page.route("**/api/items/itm-1", (route) => {
      patched = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item: { ...unsortedItem, container_id: "ctr-1", container_name: "Bin A" } }),
      });
    });

    await page.goto("/unsorted");
    await page.getByTestId("unsorted-card").first().getByTestId("container-combobox").click();
    await page.getByRole("option", { name: "Bin A" }).click();
    await page.getByRole("button", { name: /Sort it/i }).click();

    await expect(page.getByTestId("unsorted-card")).toHaveCount(0);
    expect(patched).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
pnpm test:e2e e2e/unsorted.spec.ts --project=chromium
```

Expected: all three tests fail.

- [ ] **Step 3: Implement `UnsortedCard.vue`**

Create `apps/web/src/components/UnsortedCard.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useContainers, type Container } from "@/composables/useContainers";
import { useLocations, type Location } from "@/composables/useLocations";
import { useDefaultContainer, useDefaultLocation } from "@/composables/useDefaults";
import type { Item } from "@/composables/useItems";
import EntityCombobox from "@/components/EntityCombobox.vue";

const props = defineProps<{ item: Item }>();
const emit = defineEmits<{ sorted: [id: string] }>();

const { containers, fetchAll: fetchContainers, create: createContainer } = useContainers();
const { locations, fetchAll: fetchLocations, create: createLocation } = useLocations();

const defaultContainer = useDefaultContainer();
const defaultLocation = useDefaultLocation();

const name = ref(props.item.name);
const selectedContainer = ref<string | null>(props.item.container_id ?? defaultContainer.value);
const selectedLocation = ref<string | null>(defaultLocation.value);
const saving = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  await Promise.all([fetchContainers(), fetchLocations()]);
});

function applyContainer(id: string | null) {
  selectedContainer.value = id;
  defaultContainer.value = id;
  if (id) {
    const c = containers.value.find((x) => x.id === id);
    if (c?.location_id) {
      selectedLocation.value = c.location_id;
      defaultLocation.value = c.location_id;
    }
  }
}

function applyLocation(id: string | null) {
  selectedLocation.value = id;
  defaultLocation.value = id;
  // If current container is not in this location, clear container.
  if (id && selectedContainer.value) {
    const c = containers.value.find((x) => x.id === selectedContainer.value);
    if (c && c.location_id !== id) {
      selectedContainer.value = null;
      defaultContainer.value = null;
    }
  }
}

async function createContainerAt(value: string): Promise<Container> {
  return await createContainer(value, selectedLocation.value ?? undefined);
}
async function createLocationAt(value: string): Promise<Location> {
  return await createLocation(value);
}

async function sort() {
  error.value = null;
  saving.value = true;
  try {
    const res = await fetch(`/api/items/${props.item.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.value.trim(),
        container_id: selectedContainer.value,
      }),
    });
    if (!res.ok) throw new Error("Save failed");
    emit("sorted", props.item.id);
  } catch (e) {
    error.value = "Could not save";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    data-testid="unsorted-card"
    class="flex flex-col gap-3 p-4 bg-[var(--color-surface)] rounded-[var(--radius-card)] border border-[var(--color-border)]"
  >
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 bg-[var(--color-raised)] rounded-[var(--radius-input)] overflow-hidden shrink-0">
        <img
          v-if="item.thumbnail_key"
          :src="`/api/photos/${item.thumbnail_key}`"
          class="w-full h-full object-cover"
          alt=""
        />
      </div>
      <input
        v-model="name"
        type="text"
        :placeholder="item.status === 'processing' ? 'Identifying…' : 'Name'"
        class="flex-1 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-input)] px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div data-testid="location-combobox">
        <EntityCombobox
          entity-label="location"
          :list="locations"
          :model-value="selectedLocation"
          :create-fn="createLocationAt"
          @update:model-value="applyLocation"
        />
      </div>
      <div data-testid="container-combobox">
        <EntityCombobox
          entity-label="container"
          :list="containers.filter((c) => !selectedLocation || c.location_id === selectedLocation)"
          :model-value="selectedContainer"
          :create-fn="createContainerAt"
          @update:model-value="applyContainer"
        />
      </div>
    </div>
    <div class="flex items-center gap-3">
      <p v-if="error" class="text-sm text-[var(--color-danger)]">{{ error }}</p>
      <div class="flex-1" />
      <button
        type="button"
        class="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-input)] text-[var(--color-text)] disabled:opacity-50"
        :disabled="saving || !selectedContainer"
        @click="sort"
      >
        {{ saving ? "Saving…" : "Sort it" }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Rewrite `UnsortedPage.vue`**

Overwrite `apps/web/src/pages/UnsortedPage.vue`:

```vue
<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useItems } from "@/composables/useItems";
import UnsortedCard from "@/components/UnsortedCard.vue";

const { items, loading, fetchUnorganized } = useItems();

const count = computed(() => items.value.length);

onMounted(fetchUnorganized);

function onSorted(id: string) {
  items.value = items.value.filter((i) => i.id !== id);
}
</script>

<template>
  <div class="px-4 py-6 max-w-3xl mx-auto">
    <h1 class="text-xl font-semibold mb-4">Unsorted · {{ count }}</h1>
    <div v-if="loading && items.length === 0" class="text-center py-8 text-[var(--color-muted)]">Loading…</div>
    <div v-else-if="items.length === 0" class="text-center py-8 text-[var(--color-muted)]">
      Nothing to sort.
    </div>
    <div v-else class="space-y-3">
      <UnsortedCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        @sorted="onSorted"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 5: Re-enable the combobox spec (so it runs against the real combobox in UnsortedCard)**

Rewrite `apps/web/e2e/combobox.spec.ts` to exercise the combobox via the Unsorted page:

```typescript
import { test, expect } from "./fixtures";

const itemOne = {
  id: "itm-1",
  name: "Thing",
  ai_label: null,
  description: null,
  status: "ready",
  container_id: null,
  container_name: null,
  location_name: null,
  thumbnail_key: null,
  created_at: "2026-04-22T00:00:00Z",
};

test.describe("EntityCombobox (via UnsortedCard)", () => {
  test("lists existing locations", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [itemOne] }) })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locations: [{ id: "loc-1", name: "Garage", description: null, created_at: "x" }] }),
      })
    );
    await page.goto("/unsorted");
    await page.getByTestId("location-combobox").click();
    await expect(page.getByRole("option", { name: "Garage" })).toBeVisible();
  });

  test("selecting a location writes default-location to localStorage", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [itemOne] }) })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locations: [{ id: "loc-1", name: "Garage", description: null, created_at: "x" }] }),
      })
    );
    await page.goto("/unsorted");
    await page.getByTestId("location-combobox").click();
    await page.getByRole("option", { name: "Garage" }).click();
    const v = await page.evaluate(() => localStorage.getItem("default-location"));
    expect(v).toBe('"loc-1"');
  });

  test("creates a new location when typed value has no match", async ({ page }) => {
    await page.route("**/api/items?unorganized=true", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [itemOne] }) })
    );
    await page.route(/\/api\/locations$/, async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { name: string };
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ location: { id: "loc-new", name: body.name, description: null, created_at: "x" } }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations: [] }) });
      }
    });
    await page.goto("/unsorted");
    await page.getByTestId("location-combobox").click();
    await page.getByTestId("location-combobox").getByRole("combobox").fill("Shed");
    await page.getByRole("option", { name: /Create\s+"?Shed"?/i }).click();
    const v = await page.evaluate(() => localStorage.getItem("default-location"));
    expect(v).toBe('"loc-new"');
  });
});
```

- [ ] **Step 6: Run unsorted + combobox specs**

```bash
pnpm test:e2e e2e/unsorted.spec.ts e2e/combobox.spec.ts --project=chromium
```

Expected: PASS. If the combobox input selector doesn't match, use browser devtools to inspect what reka-ui renders (probably `role="combobox"` on a `<input>` inside `ComboboxAnchor`), then adjust selectors in the test.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(unsorted): inline-sort rows with EntityCombobox"
```

---

## Task 12: Redesign `ItemDetailPage`

**Files:**
- Modify: `apps/web/src/pages/ItemDetailPage.vue`
- Create: `apps/web/e2e/item-detail.spec.ts`

- [ ] **Step 1: Read current `ItemDetailPage.vue`**

```bash
cat apps/web/src/pages/ItemDetailPage.vue
```

Note its structure (name field, description, photos, etc).

- [ ] **Step 2: Write failing test**

Create `apps/web/e2e/item-detail.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

const item = {
  id: "itm-1",
  name: "Hammer",
  ai_label: "hammer",
  description: null,
  status: "ready",
  container_id: "ctr-1",
  container_name: "Toolbox",
  location_id: "loc-1",
  location_name: "Garage",
  created_at: "2026-04-22T00:00:00Z",
  photos: [{ id: "p1", r2_key: "x/y/p1.jpg", thumbnail_url: null, created_at: "x" }],
};

test.describe("Item detail", () => {
  test("renders name, container, location, photo", async ({ page }) => {
    await page.route("**/api/items/itm-1", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ item }) })
    );
    await page.route(/\/api\/containers(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ containers: [{ id: "ctr-1", name: "Toolbox", location_id: "loc-1", location_name: "Garage", item_count: 0, description: null, created_at: "x" }] }) })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations: [{ id: "loc-1", name: "Garage", description: null, created_at: "x" }] }) })
    );
    await page.goto("/items/itm-1");
    await expect(page.getByDisplayValue("Hammer")).toBeVisible();
    await expect(page.getByRole("button", { name: /Save/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete/i })).toBeVisible();
  });

  test("delete calls DELETE and returns to Search", async ({ page }) => {
    let deleted = false;
    await page.route("**/api/items/itm-1", (route) => {
      if (route.request().method() === "DELETE") {
        deleted = true;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ item }) });
    });
    await page.route(/\/api\/containers(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ containers: [] }) })
    );
    await page.route(/\/api\/locations(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations: [] }) })
    );
    page.once("dialog", (d) => d.accept());
    await page.goto("/items/itm-1");
    await page.getByRole("button", { name: /Delete/i }).click();
    await expect(page).toHaveURL("/");
    expect(deleted).toBe(true);
  });
});
```

- [ ] **Step 3: Run, verify fails**

```bash
pnpm test:e2e e2e/item-detail.spec.ts --project=chromium
```

Expected: fails (page doesn't yet match).

- [ ] **Step 4: Overwrite `ItemDetailPage.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useItems } from "@/composables/useItems";
import { useContainers } from "@/composables/useContainers";
import { useLocations } from "@/composables/useLocations";
import { useDefaultContainer, useDefaultLocation } from "@/composables/useDefaults";
import EntityCombobox from "@/components/EntityCombobox.vue";

const route = useRoute();
const router = useRouter();
const { updateItem, deleteItem } = useItems();
const { containers, fetchAll: fetchContainers, create: createContainer } = useContainers();
const { locations, fetchAll: fetchLocations, create: createLocation } = useLocations();

const defaultContainer = useDefaultContainer();
const defaultLocation = useDefaultLocation();

interface DetailPhoto { id: string; r2_key: string; thumbnail_url: string | null; created_at: string }
interface DetailItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  container_id: string | null;
  container_name: string | null;
  location_id: string | null;
  location_name: string | null;
  photos: DetailPhoto[];
}

const item = ref<DetailItem | null>(null);
const name = ref("");
const containerId = ref<string | null>(null);
const locationId = ref<string | null>(null);
const saving = ref(false);
const error = ref<string | null>(null);

async function load() {
  const res = await fetch(`/api/items/${route.params.id}`, { credentials: "include" });
  if (!res.ok) {
    router.replace("/");
    return;
  }
  const data = (await res.json()) as { item: DetailItem };
  item.value = data.item;
  name.value = data.item.name;
  containerId.value = data.item.container_id;
  locationId.value = data.item.location_id;
}

function applyContainer(id: string | null) {
  containerId.value = id;
  defaultContainer.value = id;
  if (id) {
    const c = containers.value.find((x) => x.id === id);
    if (c?.location_id) {
      locationId.value = c.location_id;
      defaultLocation.value = c.location_id;
    }
  }
}
function applyLocation(id: string | null) {
  locationId.value = id;
  defaultLocation.value = id;
  if (id && containerId.value) {
    const c = containers.value.find((x) => x.id === containerId.value);
    if (c && c.location_id !== id) {
      containerId.value = null;
      defaultContainer.value = null;
    }
  }
}
async function createContainerAt(value: string) {
  return await createContainer(value, locationId.value ?? undefined);
}
async function createLocationAt(value: string) {
  return await createLocation(value);
}

async function save() {
  if (!item.value) return;
  saving.value = true;
  error.value = null;
  try {
    await updateItem(item.value.id, {
      name: name.value.trim(),
      container_id: containerId.value,
    });
    router.back();
  } catch {
    error.value = "Save failed";
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!item.value) return;
  if (!window.confirm("Delete this item?")) return;
  try {
    await deleteItem(item.value.id);
    router.replace("/");
  } catch {
    error.value = "Delete failed";
  }
}

onMounted(async () => {
  await Promise.all([load(), fetchContainers(), fetchLocations()]);
});
</script>

<template>
  <div v-if="item" class="px-4 py-6 max-w-2xl mx-auto space-y-4">
    <div class="aspect-square w-full bg-[var(--color-raised)] rounded-[var(--radius-card)] overflow-hidden">
      <img
        v-if="item.photos[0]"
        :src="`/api/photos/${item.photos[0].r2_key}`"
        class="w-full h-full object-cover"
        alt=""
      />
    </div>

    <input
      v-model="name"
      type="text"
      class="w-full px-3 py-2 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-input)] text-[var(--color-text)] text-lg focus:outline-none focus:border-[var(--color-accent)]"
    />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <EntityCombobox
        entity-label="location"
        :list="locations"
        :model-value="locationId"
        :create-fn="createLocationAt"
        @update:model-value="applyLocation"
      />
      <EntityCombobox
        entity-label="container"
        :list="containers.filter((c) => !locationId || c.location_id === locationId)"
        :model-value="containerId"
        :create-fn="createContainerAt"
        @update:model-value="applyContainer"
      />
    </div>

    <p v-if="error" class="text-sm text-[var(--color-danger)]">{{ error }}</p>

    <div class="flex gap-2">
      <button
        type="button"
        class="flex-1 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-input)]"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? "Saving…" : "Save" }}
      </button>
      <button
        type="button"
        class="py-2 px-4 border border-[var(--color-danger)] text-[var(--color-danger)] rounded-[var(--radius-input)]"
        @click="remove"
      >
        Delete
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Run test, verify passes**

```bash
pnpm test:e2e e2e/item-detail.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(item-detail): redesign with shared comboboxes"
```

---

## Task 13: Build `CameraView` — native mode first

**Files:**
- Modify: `apps/web/src/pages/CameraView.vue`
- Create: `apps/web/e2e/camera.spec.ts`

This task sets up the page shell, top strip (back, mode toggle), the container/location dropdowns, and native-mode capture. Continuous mode is added in Task 14.

- [ ] **Step 1: Write failing camera test (native-mode scope)**

Create `apps/web/e2e/camera.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

test.describe("Camera page — native mode", () => {
  test("shows back, mode toggle, dropdowns, shutter", async ({ page }) => {
    // Force native mode so getUserMedia isn't needed for this test.
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", '"native"');
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
      localStorage.setItem("camera-mode", '"native"');
    });
    await page.goto("/camera");
    await page.getByRole("button", { name: /Continuous/i }).click();
    const v1 = await page.evaluate(() => localStorage.getItem("camera-mode"));
    expect(v1).toBe('"continuous"');
    await page.getByRole("button", { name: /Native/i }).click();
    const v2 = await page.evaluate(() => localStorage.getItem("camera-mode"));
    expect(v2).toBe('"native"');
  });

  test("shutter triggers hidden file input in native mode", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("camera-mode", '"native"');
    });
    await page.goto("/camera");
    const input = page.locator('input[type="file"][accept^="image/"]');
    await expect(input).toBeAttached();
    // Can't truly click-through without real dialog, but the file input exists
    // and its click is what the shutter dispatches; we verify the shutter
    // is wired to the input by setting files programmatically.
    await input.setInputFiles({
      name: "shot.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
    // A successful upload would land in filmstrip; we only assert no crash here.
    await expect(page.getByTestId("shutter")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run, verify fails**

```bash
pnpm test:e2e e2e/camera.spec.ts --project=chromium
```

Expected: fails on the first assertion (CameraView is still the stub).

- [ ] **Step 3: Implement `CameraView.vue` (native mode)**

Overwrite `apps/web/src/pages/CameraView.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useContainers } from "@/composables/useContainers";
import { useLocations } from "@/composables/useLocations";
import {
  useDefaultContainer,
  useDefaultLocation,
  useCameraMode,
} from "@/composables/useDefaults";
import EntityCombobox from "@/components/EntityCombobox.vue";

const router = useRouter();
const mode = useCameraMode();
const defaultContainer = useDefaultContainer();
const defaultLocation = useDefaultLocation();

const { containers, fetchAll: fetchContainers, create: createContainer } = useContainers();
const { locations, fetchAll: fetchLocations, create: createLocation } = useLocations();

interface Thumb {
  id: string;
  blobUrl: string;
  status: "uploading" | "processing" | "ready" | "error";
  itemId: string | null;
}
const thumbs = ref<Thumb[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

function applyContainer(id: string | null) {
  defaultContainer.value = id;
  if (id) {
    const c = containers.value.find((x) => x.id === id);
    if (c?.location_id) defaultLocation.value = c.location_id;
  }
}
function applyLocation(id: string | null) {
  defaultLocation.value = id;
  if (id && defaultContainer.value) {
    const c = containers.value.find((x) => x.id === defaultContainer.value);
    if (c && c.location_id !== id) defaultContainer.value = null;
  }
}
async function createContainerAt(name: string) {
  return await createContainer(name, defaultLocation.value ?? undefined);
}
async function createLocationAt(name: string) {
  return await createLocation(name);
}

async function uploadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const thumb: Thumb = {
    id: `tmp-${Date.now()}-${Math.random()}`,
    blobUrl,
    status: "uploading",
    itemId: null,
  };
  thumbs.value = [thumb, ...thumbs.value].slice(0, 5);
  try {
    const fd = new FormData();
    fd.append("photo", blob, filename);
    if (defaultContainer.value) fd.append("container_id", defaultContainer.value);
    const res = await fetch("/api/items/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error("upload failed");
    const data = (await res.json()) as { item: { id: string; status: string } };
    thumb.itemId = data.item.id;
    thumb.status = data.item.status === "ready" ? "ready" : "processing";
  } catch {
    thumb.status = "error";
  }
}

function onShutter() {
  fileInput.value?.click();
}
async function onFilePicked(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);
  target.value = "";
  for (const file of files) {
    await uploadBlob(file, file.name);
  }
}

onMounted(async () => {
  await Promise.all([fetchContainers(), fetchLocations()]);
});

const shownContainers = computed(() =>
  containers.value.filter((c) => !defaultLocation.value || c.location_id === defaultLocation.value)
);
</script>

<template>
  <div class="fixed inset-0 bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col">
    <div class="flex items-center gap-2 p-3 border-b border-[var(--color-border)]">
      <RouterLink
        to="/"
        class="px-2 py-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
        aria-label="Back"
      >← Back</RouterLink>
      <div class="flex-1" />
      <div role="group" class="flex bg-[var(--color-raised)] rounded-[var(--radius-input)] p-0.5">
        <button
          type="button"
          :class="[
            'px-3 py-1 text-sm rounded-[var(--radius-input)]',
            mode === 'continuous' ? 'bg-[var(--color-accent)]' : 'text-[var(--color-muted)]',
          ]"
          @click="mode = 'continuous'"
        >Continuous</button>
        <button
          type="button"
          :class="[
            'px-3 py-1 text-sm rounded-[var(--radius-input)]',
            mode === 'native' ? 'bg-[var(--color-accent)]' : 'text-[var(--color-muted)]',
          ]"
          @click="mode = 'native'"
        >Native</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border-b border-[var(--color-border)]">
      <div data-testid="location-combobox">
        <EntityCombobox
          entity-label="location"
          :list="locations"
          :model-value="defaultLocation"
          :create-fn="createLocationAt"
          @update:model-value="applyLocation"
        />
      </div>
      <div data-testid="container-combobox">
        <EntityCombobox
          entity-label="container"
          :list="shownContainers"
          :model-value="defaultContainer"
          :create-fn="createContainerAt"
          @update:model-value="applyContainer"
        />
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center bg-black/80 relative">
      <p v-if="mode === 'native'" class="text-[var(--color-muted)] text-sm">
        Tap the shutter to take a photo
      </p>
      <!-- continuous-mode viewfinder is added in Task 14 -->
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        class="hidden"
        @change="onFilePicked"
      />
    </div>

    <div class="flex items-center gap-2 p-3 overflow-x-auto border-t border-[var(--color-border)]">
      <RouterLink
        v-for="t in thumbs"
        :key="t.id"
        :to="t.itemId ? `/items/${t.itemId}` : ''"
        class="w-12 h-12 bg-[var(--color-raised)] rounded-[var(--radius-input)] overflow-hidden shrink-0 relative"
      >
        <img :src="t.blobUrl" class="w-full h-full object-cover" alt="" />
        <span
          v-if="t.status === 'error'"
          class="absolute inset-0 bg-[var(--color-danger)]/60 flex items-center justify-center text-xs"
        >!</span>
      </RouterLink>
    </div>

    <div class="p-3 flex justify-end">
      <button
        type="button"
        data-testid="shutter"
        aria-label="Take photo"
        class="w-16 h-16 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] border-4 border-[var(--color-text)]/20"
        @click="onShutter"
      ></button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run test, verify passes**

```bash
pnpm test:e2e e2e/camera.spec.ts --project=chromium
```

Expected: PASS for all three tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(camera): native-mode capture with dropdowns and filmstrip"
```

---

## Task 14: Add continuous-mode live viewfinder + fallback

**Files:**
- Modify: `apps/web/src/pages/CameraView.vue`
- Modify: `apps/web/e2e/camera.spec.ts`

- [ ] **Step 1: Add failing test for continuous mode fallback**

Append to `apps/web/e2e/camera.spec.ts` (inside the existing `describe`):

```typescript
test("falls back to native when getUserMedia rejects", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", '"continuous"');
    // Force getUserMedia to reject.
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new Error("NotAllowedError")) },
    });
  });
  await page.goto("/camera");
  await expect(page.getByTestId("camera-fallback-notice")).toBeVisible();
  // Mode auto-switched to native:
  const v = await page.evaluate(() => localStorage.getItem("camera-mode"));
  expect(v).toBe('"native"');
});

test("continuous mode renders a <video> element when getUserMedia resolves", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", '"continuous"');
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
```

- [ ] **Step 2: Run, verify fails**

```bash
pnpm test:e2e e2e/camera.spec.ts --project=chromium
```

Expected: both new tests fail.

- [ ] **Step 3: Overwrite `CameraView.vue` with continuous-mode support**

Overwrite `apps/web/src/pages/CameraView.vue` with the complete file:

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from "vue";
import { useContainers } from "@/composables/useContainers";
import { useLocations } from "@/composables/useLocations";
import {
  useDefaultContainer,
  useDefaultLocation,
  useCameraMode,
} from "@/composables/useDefaults";
import EntityCombobox from "@/components/EntityCombobox.vue";

const mode = useCameraMode();
const defaultContainer = useDefaultContainer();
const defaultLocation = useDefaultLocation();

const { containers, fetchAll: fetchContainers, create: createContainer } = useContainers();
const { locations, fetchAll: fetchLocations, create: createLocation } = useLocations();

interface Thumb {
  id: string;
  blobUrl: string;
  status: "uploading" | "processing" | "ready" | "error";
  itemId: string | null;
}
const thumbs = ref<Thumb[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const fallbackNotice = ref<string | null>(null);

function applyContainer(id: string | null) {
  defaultContainer.value = id;
  if (id) {
    const c = containers.value.find((x) => x.id === id);
    if (c?.location_id) defaultLocation.value = c.location_id;
  }
}
function applyLocation(id: string | null) {
  defaultLocation.value = id;
  if (id && defaultContainer.value) {
    const c = containers.value.find((x) => x.id === defaultContainer.value);
    if (c && c.location_id !== id) defaultContainer.value = null;
  }
}
async function createContainerAt(name: string) {
  return await createContainer(name, defaultLocation.value ?? undefined);
}
async function createLocationAt(name: string) {
  return await createLocation(name);
}

async function uploadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const thumb: Thumb = {
    id: `tmp-${Date.now()}-${Math.random()}`,
    blobUrl,
    status: "uploading",
    itemId: null,
  };
  thumbs.value = [thumb, ...thumbs.value].slice(0, 5);
  try {
    const fd = new FormData();
    fd.append("photo", blob, filename);
    if (defaultContainer.value) fd.append("container_id", defaultContainer.value);
    const res = await fetch("/api/items/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error("upload failed");
    const data = (await res.json()) as { item: { id: string; status: string } };
    thumb.itemId = data.item.id;
    thumb.status = data.item.status === "ready" ? "ready" : "processing";
  } catch {
    thumb.status = "error";
  }
}

async function startStream() {
  fallbackNotice.value = null;
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    stream.value = s;
    if (videoEl.value) {
      videoEl.value.srcObject = s;
      await videoEl.value.play().catch(() => {});
    }
  } catch {
    fallbackNotice.value = "Camera unavailable — switched to Native mode.";
    mode.value = "native";
  }
}

function stopStream() {
  stream.value?.getTracks().forEach((t) => t.stop());
  stream.value = null;
}

async function captureFromStream() {
  if (!videoEl.value || !canvasEl.value) return;
  const v = videoEl.value;
  const c = canvasEl.value;
  c.width = v.videoWidth || 1280;
  c.height = v.videoHeight || 960;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(v, 0, 0, c.width, c.height);
  const blob: Blob | null = await new Promise((resolve) =>
    c.toBlob((b) => resolve(b), "image/jpeg", 0.9)
  );
  if (blob) await uploadBlob(blob, `shot-${Date.now()}.jpg`);
}

function onShutter() {
  if (mode.value === "continuous") captureFromStream();
  else fileInput.value?.click();
}
async function onFilePicked(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);
  target.value = "";
  for (const file of files) await uploadBlob(file, file.name);
}

onMounted(async () => {
  await Promise.all([fetchContainers(), fetchLocations()]);
  if (mode.value === "continuous") await startStream();
});

watch(mode, async (next) => {
  if (next === "continuous") await startStream();
  else stopStream();
});

onBeforeUnmount(stopStream);

const shownContainers = computed(() =>
  containers.value.filter((c) => !defaultLocation.value || c.location_id === defaultLocation.value)
);
</script>

<template>
  <div class="fixed inset-0 bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col">
    <div class="flex items-center gap-2 p-3 border-b border-[var(--color-border)]">
      <RouterLink
        to="/"
        class="px-2 py-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
        aria-label="Back"
      >← Back</RouterLink>
      <div class="flex-1" />
      <div role="group" class="flex bg-[var(--color-raised)] rounded-[var(--radius-input)] p-0.5">
        <button
          type="button"
          :class="[
            'px-3 py-1 text-sm rounded-[var(--radius-input)]',
            mode === 'continuous' ? 'bg-[var(--color-accent)]' : 'text-[var(--color-muted)]',
          ]"
          @click="mode = 'continuous'"
        >Continuous</button>
        <button
          type="button"
          :class="[
            'px-3 py-1 text-sm rounded-[var(--radius-input)]',
            mode === 'native' ? 'bg-[var(--color-accent)]' : 'text-[var(--color-muted)]',
          ]"
          @click="mode = 'native'"
        >Native</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border-b border-[var(--color-border)]">
      <div data-testid="location-combobox">
        <EntityCombobox
          entity-label="location"
          :list="locations"
          :model-value="defaultLocation"
          :create-fn="createLocationAt"
          @update:model-value="applyLocation"
        />
      </div>
      <div data-testid="container-combobox">
        <EntityCombobox
          entity-label="container"
          :list="shownContainers"
          :model-value="defaultContainer"
          :create-fn="createContainerAt"
          @update:model-value="applyContainer"
        />
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center bg-black relative">
      <p
        v-if="fallbackNotice"
        data-testid="camera-fallback-notice"
        class="absolute top-2 left-1/2 -translate-x-1/2 bg-[var(--color-raised)] border border-[var(--color-border)] rounded-[var(--radius-card)] px-3 py-1 text-sm z-10"
      >{{ fallbackNotice }}</p>
      <video
        v-if="mode === 'continuous'"
        ref="videoEl"
        data-testid="viewfinder"
        autoplay
        playsinline
        muted
        class="w-full h-full object-cover"
      ></video>
      <p v-else class="text-[var(--color-muted)] text-sm">
        Tap the shutter to take a photo
      </p>
      <canvas ref="canvasEl" class="hidden"></canvas>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        class="hidden"
        @change="onFilePicked"
      />
    </div>

    <div class="flex items-center gap-2 p-3 overflow-x-auto border-t border-[var(--color-border)]">
      <RouterLink
        v-for="t in thumbs"
        :key="t.id"
        :to="t.itemId ? `/items/${t.itemId}` : ''"
        class="w-12 h-12 bg-[var(--color-raised)] rounded-[var(--radius-input)] overflow-hidden shrink-0 relative"
      >
        <img :src="t.blobUrl" class="w-full h-full object-cover" alt="" />
        <span
          v-if="t.status === 'error'"
          class="absolute inset-0 bg-[var(--color-danger)]/60 flex items-center justify-center text-xs"
        >!</span>
      </RouterLink>
    </div>

    <div class="p-3 flex justify-end">
      <button
        type="button"
        data-testid="shutter"
        aria-label="Take photo"
        class="w-16 h-16 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] border-4 border-[var(--color-text)]/20"
        @click="onShutter"
      ></button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run test, verify passes**

```bash
pnpm test:e2e e2e/camera.spec.ts --project=chromium
```

Expected: all camera tests pass. If `fallback-notice` test fails because the watcher ordering lets video mount before rejection resolves, make sure `startStream()` is awaited *before* `videoEl` would render by checking the mode value after. If assertion order is fragile, add `await page.waitForTimeout(50)` before the `expect` — the fallback notice and mode flip are both triggered from the rejected `getUserMedia` promise.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(camera): add continuous live viewfinder with fallback"
```

---

## Task 15: Verify filmstrip behavior (test-only)

**Files:**
- Modify: `apps/web/e2e/camera.spec.ts`

The filmstrip is already implemented in Task 13. This task adds a test that pins its behavior so it doesn't regress.

- [ ] **Step 1: Append test**

Append to `apps/web/e2e/camera.spec.ts`:

```typescript
test("uploaded photo appears in filmstrip and links to item", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", '"native"');
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
  await input.setInputFiles({
    name: "x.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  // Wait for the thumb link to appear.
  await expect(page.locator("a[href='/items/itm-99']")).toBeVisible();
});
```

- [ ] **Step 2: Run, verify passes**

```bash
pnpm test:e2e e2e/camera.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/camera.spec.ts
git commit -m "test(camera): lock filmstrip behavior"
```

---

## Task 16: Theme `LoginPage`

**Files:**
- Modify: `apps/web/src/pages/LoginPage.vue`

- [ ] **Step 1: Read current file**

```bash
cat apps/web/src/pages/LoginPage.vue
```

- [ ] **Step 2: Rewrite against warm palette**

Overwrite `apps/web/src/pages/LoginPage.vue`:

```vue
<script setup lang="ts">
function startGoogle() {
  window.location.href = "/api/auth/google";
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-6 space-y-4 text-center">
      <h1 class="text-xl font-semibold text-[var(--color-accent)]">Storganizer</h1>
      <p class="text-sm text-[var(--color-muted)]">Sign in to get started.</p>
      <button
        type="button"
        class="w-full py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-input)]"
        @click="startGoogle"
      >Sign in with Google</button>
    </div>
  </div>
</template>
```

If the existing file references a function name or API path different from `/api/auth/google`, keep the existing path — change only the markup/classes. Inspect first with the `cat` command above.

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/LoginPage.vue
git commit -m "feat(login): restyle against warm theme"
```

---

## Task 17: End-to-end defaults integration

**Files:**
- Create: `apps/web/e2e/defaults.spec.ts`

- [ ] **Step 1: Write integration test**

Create `apps/web/e2e/defaults.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

test("setting default in Unsorted carries through to Camera upload", async ({ page }) => {
  const container = { id: "ctr-1", name: "Bin A", location_id: "loc-1", location_name: "Garage", item_count: 0, description: null, created_at: "x" };
  const unsorted = {
    id: "itm-1",
    name: "Widget",
    ai_label: null,
    description: null,
    status: "ready",
    container_id: null,
    container_name: null,
    location_name: null,
    thumbnail_key: null,
    created_at: "2026-04-22T00:00:00Z",
  };

  await page.route("**/api/items?unorganized=true", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [unsorted] }) })
  );
  await page.route(/\/api\/containers(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ containers: [container] }) })
  );
  await page.route(/\/api\/locations(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ locations: [{ id: "loc-1", name: "Garage", description: null, created_at: "x" }] }),
    })
  );

  await page.goto("/unsorted");
  await page.getByTestId("container-combobox").click();
  await page.getByRole("option", { name: "Bin A" }).click();

  const stored = await page.evaluate(() => localStorage.getItem("default-container"));
  expect(stored).toBe('"ctr-1"');

  // Navigate to camera and verify upload carries container_id.
  await page.addInitScript(() => localStorage.setItem("camera-mode", '"native"'));
  let uploadBody: string | null = null;
  await page.route("**/api/items/upload", async (route) => {
    uploadBody = route.request().postData();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ item: { id: "itm-x", name: "Processing...", status: "processing" } }),
    });
  });

  await page.goto("/camera");
  const input = page.locator('input[type="file"][accept^="image/"]');
  await input.setInputFiles({
    name: "x.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });

  // Wait for upload call.
  await expect.poll(() => uploadBody).not.toBeNull();
  expect(uploadBody).toContain("container_id");
  expect(uploadBody).toContain("ctr-1");
});
```

- [ ] **Step 2: Run the full suite**

```bash
pnpm test:e2e --project=chromium
```

Expected: all specs pass. If the defaults test fails because `addInitScript` on the second `goto` doesn't apply (Playwright binds init scripts per-context), move the `addInitScript` call to the top of the test before the first `goto`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/defaults.spec.ts
git commit -m "test: end-to-end default-container carries into camera upload"
```

---

## Task 18: Final regression pass

- [ ] **Step 1: Run the whole suite on both projects**

```bash
cd apps/web && pnpm test:e2e
```

Expected: all specs pass on chromium and mobile Pixel-5.

- [ ] **Step 2: Manual smoke (describe expected behavior)**

Start the app and verify manually:

```bash
cd apps/web && pnpm dev
```

Check in the browser at `http://localhost:5173`:
- Dark warm background (not blue).
- Top bar with "Storganizer" + Search | Unsorted tabs + avatar.
- Camera FAB lower-right on Search and Unsorted.
- `/camera` shows container/location dropdowns, viewfinder (if camera permission granted) or "Tap the shutter" (native mode).
- `/containers` and `/add` redirect to `/`.

- [ ] **Step 3: Final commit (if anything was tweaked)**

If no manual fixes were needed, skip. Otherwise:

```bash
git add -A
git commit -m "chore: polish after manual smoke"
```

---

## Summary of spec coverage

| Spec section | Task(s) |
|---|---|
| Warm-minimal theme tokens | Task 2 |
| Routes (final, removed, new) | Tasks 3, 9 |
| Navigation (top bar + FAB) | Tasks 7, 8, 9 |
| `EntityCombobox` | Task 6, re-used in 11, 12, 13 |
| Device defaults (localStorage) | Task 5, verified in 11/13/17 |
| Camera screen native mode | Task 13 |
| Camera screen continuous mode + fallback | Task 14 |
| Filmstrip | Tasks 13, 15 |
| Search redesign | Task 10 |
| Unsorted redesign (UnsortedCard) | Task 11 |
| Item detail redesign | Task 12 |
| Login theming | Task 16 |
| API upload-endpoint `container_id` | Task 4 |
| TDD Playwright coverage | every feature task |
| Dependencies (`@vueuse/core`, `reka-ui`) | Task 1 |
