# DB-first photo upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the item upload flow so that D1 insert is the commit point (<200ms after bytes arrive at the Worker), defer R2 and queue work via `ctx.waitUntil`, compress photos client-side to ~100–200KB before upload, and display a green left-to-right progress overlay on camera thumbnails.

**Architecture:** Two new client utilities (`resizeAndCompress`, `uploadWithProgress`) replace the raw `fetch` in `CameraView.vue`'s upload path. The Hono upload handler is rewritten so that after multipart parsing it `INSERT`s the item row (status `'uploading'`), responds 201 immediately, and uses `c.executionCtx.waitUntil` for R2 put + `item_photos` insert + queue enqueue, ending with `UPDATE items SET status='processing'`. Failures inside `waitUntil` flip status to `'upload_failed'`. The queue consumer is unchanged.

**Tech Stack:** Vue 3 + Vite (apps/web), Hono on Cloudflare Workers (apps/api), D1, R2, Cloudflare Queues, Workers AI. Tests: `@cloudflare/vitest-pool-workers` for API, Playwright for web e2e. No new dependencies.

Spec: `docs/superpowers/specs/2026-04-23-db-first-photo-upload-design.md`.

---

## File structure

**New files**
- `apps/web/src/lib/resizeAndCompress.ts` — one exported async function. Single responsibility: take a `Blob`, return a smaller JPEG `Blob`.
- `apps/web/src/lib/uploadWithProgress.ts` — one exported function. XHR-backed multipart POST with upload-progress callbacks.

**Modified files**
- `apps/api/src/routes/items.ts` — rewrite `POST /upload` handler. Keep the rest of the file as-is.
- `apps/web/src/pages/CameraView.vue` — extend `Thumb` interface, rewrite `uploadBlob`, add `retryThumb`, add progress overlay `<span>` in template.
- `apps/api/test/upload.test.ts` — existing cases need updated expectations (status `'uploading'` at 201 time, eventually `'processing'`); add new cases for `waitUntil` completion and failure path.
- `apps/web/e2e/camera.spec.ts` — existing test "uploaded photo appears in filmstrip and links to item" currently asserts mock returns `status: "processing"`; update to `status: "uploading"` for realism.

**No schema migration needed.** `items.status` in `apps/api/src/db/migrations/0001_initial.sql` is plain `TEXT` with no CHECK constraint — new values `'uploading'` and `'upload_failed'` are accepted.

---

## Task 1: `resizeAndCompress` utility + large-upload regression test

**Files:**
- Create: `apps/web/src/lib/resizeAndCompress.ts`
- Create: `apps/web/e2e/camera-compression.spec.ts`
- Modify: `apps/web/src/pages/CameraView.vue:53-78` (wire into `uploadBlob`)

- [ ] **Step 1: Write failing e2e for compression**

Create `apps/web/e2e/camera-compression.spec.ts`:

```ts
import { test, expect } from "./fixtures";

test("native-mode upload body is under 250KB even when source is a 5MB JPEG", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", "native");
  });

  let uploadedBytes: number | null = null;
  await page.route("**/api/items/upload", async (route) => {
    const buf = route.request().postDataBuffer();
    uploadedBytes = buf ? buf.byteLength : 0;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        item: { id: "itm-compressed", name: "Processing...", status: "uploading" },
      }),
    });
  });

  await page.goto("/camera");

  // Build a ~5MB real JPEG in-page so createImageBitmap can decode it.
  const bigJpeg = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const ctx = canvas.getContext("2d")!;
    // Draw a noisy gradient so JPEG can't trivially compress to tiny size.
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.floor(Math.random() * 256);
      img.data[i + 1] = Math.floor(Math.random() * 256);
      img.data[i + 2] = Math.floor(Math.random() * 256);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.95));
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  });

  const input = page.locator('input[type="file"][accept^="image/"]');
  await input.setInputFiles({
    name: "big.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(bigJpeg),
  });

  await page.waitForResponse("**/api/items/upload");
  expect(uploadedBytes).not.toBeNull();
  expect(uploadedBytes!).toBeLessThan(250_000);
});
```

- [ ] **Step 2: Run the test — it should fail**

```bash
cd apps/web && pnpm test:e2e camera-compression.spec.ts
```

Expected: FAIL — upload body is ~5MB, nowhere near 250KB.

- [ ] **Step 3: Create `apps/web/src/lib/resizeAndCompress.ts`**

```ts
export async function resizeAndCompress(
  blob: Blob,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<Blob> {
  const maxDim = opts.maxDim ?? 1024;
  const quality = opts.quality ?? 0.8;

  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("toBlob produced null"))),
      "image/jpeg",
      quality
    )
  );
}
```

- [ ] **Step 4: Wire into `CameraView.vue`**

In `apps/web/src/pages/CameraView.vue`, add import below the existing imports near line 10:

```ts
import { resizeAndCompress } from "@/lib/resizeAndCompress";
```

Replace the body of `uploadBlob` (currently lines 53–78) with:

```ts
async function uploadBlob(rawBlob: Blob, filename: string) {
  const blob = await resizeAndCompress(rawBlob, { maxDim: 1024, quality: 0.8 });
  const blobUrl = URL.createObjectURL(blob);
  const thumb = reactive<Thumb>({
    id: `tmp-${Date.now()}-${Math.random()}`,
    blobUrl,
    status: "uploading",
    itemId: null,
  });
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
```

(Task 2 replaces the `fetch` with `uploadWithProgress`; progress/blob fields on `Thumb` land there too. Keeping changes minimal per-task.)

- [ ] **Step 5: Re-run the compression e2e — should now pass**

```bash
cd apps/web && pnpm test:e2e camera-compression.spec.ts
```

Expected: PASS. Upload body is under 250KB.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/resizeAndCompress.ts \
        apps/web/e2e/camera-compression.spec.ts \
        apps/web/src/pages/CameraView.vue
git commit -m "feat(camera): compress photos client-side before upload"
```

---

## Task 2: `uploadWithProgress` + green progress overlay

**Files:**
- Create: `apps/web/src/lib/uploadWithProgress.ts`
- Create: `apps/web/e2e/camera-progress-overlay.spec.ts`
- Modify: `apps/web/src/pages/CameraView.vue` (Thumb interface, uploadBlob body, template overlay)

- [ ] **Step 1: Write failing e2e for progress overlay**

Create `apps/web/e2e/camera-progress-overlay.spec.ts`:

```ts
import { test, expect } from "./fixtures";

test("green progress overlay appears on thumb during upload and reaches 100%", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", "native");
  });

  // Delay the upload response so the progress bar has visible time to grow.
  await page.route("**/api/items/upload", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        item: { id: "itm-progress", name: "Processing...", status: "uploading" },
      }),
    });
  });

  await page.goto("/camera");

  const input = page.locator('input[type="file"][accept^="image/"]');
  await input.setInputFiles({
    name: "p.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });

  const bar = page.getByRole("progressbar").first();
  await expect(bar).toBeVisible();

  await page.waitForResponse("**/api/items/upload");
  const valueNow = await bar.getAttribute("aria-valuenow");
  expect(Number(valueNow)).toBeGreaterThanOrEqual(99);
});
```

- [ ] **Step 2: Run the test — it should fail**

```bash
cd apps/web && pnpm test:e2e camera-progress-overlay.spec.ts
```

Expected: FAIL — no element has `role="progressbar"` yet.

- [ ] **Step 3: Create `apps/web/src/lib/uploadWithProgress.ts`**

```ts
export type UploadResult = {
  ok: boolean;
  status: number;
  json: <T = unknown>() => Promise<T>;
  text: () => Promise<string>;
};

export function uploadWithProgress(
  url: string,
  formData: FormData,
  opts: { onProgress?: (p: number) => void; signal?: AbortSignal } = {}
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    if (opts.onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) opts.onProgress!(e.loaded / e.total);
      });
      xhr.upload.addEventListener("load", () => opts.onProgress!(1));
    }
    xhr.addEventListener("load", () => {
      const text = xhr.responseText;
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async <T>() => JSON.parse(text) as T,
        text: async () => text,
      });
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError"))
    );

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}
```

- [ ] **Step 4: Extend the `Thumb` interface in `CameraView.vue`**

Replace lines 19–25 (the `Thumb` interface + `thumbs` ref) with:

```ts
interface Thumb {
  id: string;
  blobUrl: string;
  blob: Blob;
  status: "uploading" | "processing" | "ready" | "error";
  progress: number;
  itemId: string | null;
}
const thumbs = ref<Thumb[]>([]);
```

- [ ] **Step 5: Update `uploadBlob` to use `uploadWithProgress`**

Add import near the other library imports:

```ts
import { uploadWithProgress } from "@/lib/uploadWithProgress";
```

Replace the `uploadBlob` function with:

```ts
async function uploadBlob(rawBlob: Blob, filename: string) {
  const blob = await resizeAndCompress(rawBlob, { maxDim: 1024, quality: 0.8 });
  const blobUrl = URL.createObjectURL(blob);
  const thumb = reactive<Thumb>({
    id: `tmp-${Date.now()}-${Math.random()}`,
    blobUrl,
    blob,
    status: "uploading",
    progress: 0,
    itemId: null,
  });
  thumbs.value = [thumb, ...thumbs.value].slice(0, 5);
  try {
    const fd = new FormData();
    fd.append("photo", blob, filename);
    if (defaultContainer.value) fd.append("container_id", defaultContainer.value);
    const res = await uploadWithProgress("/api/items/upload", fd, {
      onProgress: (p) => {
        thumb.progress = p;
      },
    });
    if (!res.ok) throw new Error("upload failed");
    const data = await res.json<{ item: { id: string; status: string } }>();
    thumb.itemId = data.item.id;
    thumb.progress = 1;
    thumb.status = data.item.status === "ready" ? "ready" : "processing";
  } catch {
    thumb.status = "error";
  }
}
```

- [ ] **Step 6: Add the progress overlay to the template**

Replace the filmstrip `<RouterLink>` block (around CameraView.vue:237–248) with:

```vue
<RouterLink
  v-for="t in thumbs"
  :key="t.id"
  :to="t.itemId ? `/items/${t.itemId}` : ''"
  class="w-12 h-12 bg-[var(--color-raised)] rounded-[var(--radius-input)] overflow-hidden shrink-0 relative"
>
  <img :src="t.blobUrl" class="w-full h-full object-cover" alt="" />
  <span
    v-if="t.status === 'uploading' || t.status === 'processing'"
    role="progressbar"
    :aria-valuenow="Math.round(t.progress * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
    class="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-100"
    :style="{
      width: `${t.progress * 100}%`,
      backgroundColor: 'rgba(34, 197, 94, 0.35)',
    }"
  ></span>
  <span
    v-if="t.status === 'error'"
    class="absolute inset-0 bg-[var(--color-danger)]/60 flex items-center justify-center text-xs"
  >!</span>
</RouterLink>
```

- [ ] **Step 7: Re-run the progress e2e — should now pass**

```bash
cd apps/web && pnpm test:e2e camera-progress-overlay.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Re-run the compression e2e to confirm no regression**

```bash
cd apps/web && pnpm test:e2e camera-compression.spec.ts
```

Expected: still PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/uploadWithProgress.ts \
        apps/web/e2e/camera-progress-overlay.spec.ts \
        apps/web/src/pages/CameraView.vue
git commit -m "feat(camera): XHR upload with green progress overlay on thumbs"
```

---

## Task 3: DB-first API handler with `ctx.waitUntil`

**Files:**
- Modify: `apps/api/src/routes/items.ts:9-59` (rewrite `POST /upload`)
- Modify: `apps/api/test/upload.test.ts` (update expectations, add waitUntil case)
- Modify: `apps/web/e2e/camera.spec.ts:102-125` (update mock response to `status: "uploading"`)

- [ ] **Step 1: Update existing API test expectations to match new behavior**

In `apps/api/test/upload.test.ts`, at the top add imports for the vitest-pool-workers execution context helpers and the Hono `app` itself (needed to invoke the handler with a real `ExecutionContext`, since the `authRequest` helper doesn't expose one):

```ts
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { createTestUser, authRequest } from "./helpers";
import { app } from "../src/index";
```

Change the first test "uploads a photo and creates an item with processing status" — rename and update assertions:

```ts
it("responds 201 with status='uploading' before R2/queue work completes", async () => {
  const user = await createTestUser();

  const formData = new FormData();
  formData.append("photo", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");

  const res = await authRequest("/api/items/upload", {
    method: "POST",
    body: formData,
  }, user.id);

  expect(res.status).toBe(201);
  const data = await res.json() as any;
  expect(data.item.status).toBe("uploading");
  expect(data.item.name).toBe("Processing...");
  expect(data.item.id).toBeDefined();

  // The row exists in D1 at response time.
  const row = await env.DB.prepare(
    "SELECT id, status FROM items WHERE id = ?"
  ).bind(data.item.id).first<{ id: string; status: string }>();
  expect(row).not.toBeNull();
  expect(row!.status).toBe("uploading");
});
```

Update the "stores image in R2" test to flush waitUntil and check the final state. Replace the whole test body with:

```ts
it("after waitUntil settles, status='processing', R2 object exists, and queue got a message", async () => {
  const user = await createTestUser();

  const formData = new FormData();
  formData.append("photo", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");

  // authRequest doesn't expose the ctx; inline the equivalent so we can
  // pass our own ExecutionContext and flush waitUntil afterward.
  const headers = new Headers();
  headers.set("x-test-user-id", user.id);
  const ctx = createExecutionContext();
  const res = await app.request("/api/items/upload",
    { method: "POST", headers, body: formData },
    env, ctx
  );

  expect(res.status).toBe(201);
  const data = await res.json() as any;

  // Let the waitUntil-registered work finish.
  await waitOnExecutionContext(ctx);

  const row = await env.DB.prepare(
    "SELECT status FROM items WHERE id = ?"
  ).bind(data.item.id).first<{ status: string }>();
  expect(row!.status).toBe("processing");

  const photo = await env.DB.prepare(
    "SELECT r2_key FROM item_photos WHERE item_id = ?"
  ).bind(data.item.id).first<{ r2_key: string }>();
  expect(photo).not.toBeNull();

  const obj = await env.STORAGE.get(photo!.r2_key);
  expect(obj).not.toBeNull();
});
```

Leave the "rejects request without photo" test unchanged.

- [ ] **Step 2: Run the API tests — should fail**

```bash
cd apps/api && pnpm test upload.test.ts
```

Expected: FAIL — current handler returns `status="processing"` and performs R2/queue synchronously; new test wants `"uploading"` at response time and `"processing"` only after waitUntil.

- [ ] **Step 3: Rewrite the upload handler**

In `apps/api/src/routes/items.ts`, replace lines 9–59 (the whole `items.post("/upload", ...)` block) with:

```ts
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
  const contentType = photo.type;
  const arrayBuffer = await photo.arrayBuffer();

  await c.env.DB.prepare(
    "INSERT INTO items (id, user_id, name, status, container_id) VALUES (?, ?, 'Processing...', 'uploading', ?)"
  ).bind(itemId, userId, containerId).run();

  const item = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.ai_label, i.status, i.container_id, i.created_at,
     c.name as container_name
     FROM items i LEFT JOIN containers c ON c.id = i.container_id
     WHERE i.id = ?`
  ).bind(itemId).first();

  c.executionCtx.waitUntil((async () => {
    try {
      await c.env.STORAGE.put(r2Key, arrayBuffer, {
        httpMetadata: { contentType },
      });
      await c.env.DB.prepare(
        "INSERT INTO item_photos (id, item_id, r2_key) VALUES (?, ?, ?)"
      ).bind(photoId, itemId, r2Key).run();
      await c.env.IMAGE_QUEUE.send({ item_id: itemId, photo_r2_key: r2Key });
      await c.env.DB.prepare(
        "UPDATE items SET status = 'processing' WHERE id = ?"
      ).bind(itemId).run();
    } catch (err) {
      console.error(`Upload background work failed for item ${itemId}:`, err);
      await c.env.DB.prepare(
        "UPDATE items SET status = 'upload_failed' WHERE id = ?"
      ).bind(itemId).run();
    }
  })());

  return c.json({ item }, 201);
});
```

- [ ] **Step 4: Update the camera.spec.ts mock to return `status: "uploading"`**

In `apps/web/e2e/camera.spec.ts`, around line 111, change the mock response `status: "processing"` to `status: "uploading"` so it reflects the real API shape:

```ts
body: JSON.stringify({
  item: { id: "itm-99", name: "Processing...", status: "uploading" },
}),
```

(The thumbnail logic in `CameraView.vue` maps anything non-`"ready"` to the `processing` UI state, so visual behavior is unchanged, but the mock should match real response shape.)

- [ ] **Step 5: Run API tests — should pass**

```bash
cd apps/api && pnpm test upload.test.ts
```

Expected: PASS (all three cases).

- [ ] **Step 6: Run full API suite to check for regressions**

```bash
cd apps/api && pnpm test
```

Expected: all green. If `items.test.ts` or `queue.test.ts` asserts on upload behavior, update those assertions to match the new flow (status=`'uploading'` initially).

- [ ] **Step 7: Run the camera e2e to confirm the existing filmstrip test still passes**

```bash
cd apps/web && pnpm test:e2e camera.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/items.ts \
        apps/api/test/upload.test.ts \
        apps/web/e2e/camera.spec.ts
git commit -m "feat(api): make D1 insert the upload commit point, defer R2/queue via waitUntil"
```

---

## Task 4: `upload_failed` path + error-thumb retry

**Files:**
- Modify: `apps/api/test/upload.test.ts` (add failure-path test)
- Modify: `apps/web/src/pages/CameraView.vue` (add `retryThumb`, wire errored-thumb click)
- Create: `apps/web/e2e/camera-upload-retry.spec.ts`

- [ ] **Step 1: Add API test for `upload_failed` path**

Append to `apps/api/test/upload.test.ts` inside the same `describe` block:

```ts
it("flips status to 'upload_failed' if R2 put throws, and skips the queue", async () => {
  const user = await createTestUser();

  const formData = new FormData();
  formData.append("photo", new Blob([PNG_BYTES], { type: "image/png" }), "test.png");

  // Monkey-patch env.STORAGE.put to throw for this test only.
  const originalPut = env.STORAGE.put.bind(env.STORAGE);
  (env.STORAGE as any).put = async () => {
    throw new Error("simulated R2 failure");
  };

  try {
    const headers = new Headers();
    headers.set("x-test-user-id", user.id);
    const ctx = createExecutionContext();
    const res = await app.request("/api/items/upload",
      { method: "POST", headers, body: formData },
      env, ctx
    );
    expect(res.status).toBe(201);
    const data = await res.json() as any;
    await waitOnExecutionContext(ctx);

    const row = await env.DB.prepare(
      "SELECT status FROM items WHERE id = ?"
    ).bind(data.item.id).first<{ status: string }>();
    expect(row!.status).toBe("upload_failed");

    const photo = await env.DB.prepare(
      "SELECT r2_key FROM item_photos WHERE item_id = ?"
    ).bind(data.item.id).first();
    expect(photo).toBeNull();
  } finally {
    (env.STORAGE as any).put = originalPut;
  }
});
```

- [ ] **Step 2: Run — should pass (implementation from Task 3 already handles this)**

```bash
cd apps/api && pnpm test upload.test.ts
```

Expected: PASS.

- [ ] **Step 3: Write failing e2e for retry**

Create `apps/web/e2e/camera-upload-retry.spec.ts`:

```ts
import { test, expect } from "./fixtures";

test("errored thumb becomes retry button; clicking retries and succeeds", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("camera-mode", "native");
  });

  let callCount = 0;
  await page.route("**/api/items/upload", async (route) => {
    callCount++;
    if (callCount === 1) {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    } else {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          item: { id: "itm-retry", name: "Processing...", status: "uploading" },
        }),
      });
    }
  });

  await page.goto("/camera");
  const input = page.locator('input[type="file"][accept^="image/"]');
  await input.setInputFiles({
    name: "r.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });

  // First upload fails — look for a retry button.
  const retry = page.getByRole("button", { name: /retry/i }).first();
  await expect(retry).toBeVisible();

  await retry.click();
  await page.waitForResponse(
    (resp) => resp.url().includes("/api/items/upload") && resp.status() === 201
  );

  // After retry, the filmstrip should have an active link to the real item.
  await expect(page.locator("a[href='/items/itm-retry']")).toBeVisible();
});
```

- [ ] **Step 4: Run the retry test — should fail**

```bash
cd apps/web && pnpm test:e2e camera-upload-retry.spec.ts
```

Expected: FAIL — no retry button, errored thumb currently just shows `!` inside a RouterLink.

- [ ] **Step 5: Add `retryThumb` and render errored thumbs as buttons**

In `apps/web/src/pages/CameraView.vue`, add this function next to `uploadBlob`:

```ts
async function retryThumb(thumb: Thumb) {
  if (thumb.status !== "error") return;
  thumb.status = "uploading";
  thumb.progress = 0;
  thumb.itemId = null;
  try {
    const fd = new FormData();
    fd.append("photo", thumb.blob, `retry-${thumb.id}.jpg`);
    if (defaultContainer.value) fd.append("container_id", defaultContainer.value);
    const res = await uploadWithProgress("/api/items/upload", fd, {
      onProgress: (p) => {
        thumb.progress = p;
      },
    });
    if (!res.ok) throw new Error("upload failed");
    const data = await res.json<{ item: { id: string; status: string } }>();
    thumb.itemId = data.item.id;
    thumb.progress = 1;
    thumb.status = data.item.status === "ready" ? "ready" : "processing";
  } catch {
    thumb.status = "error";
  }
}
```

Then split the filmstrip template into two branches — replace the whole `<RouterLink v-for ...>` block from Task 2 with:

```vue
<template v-for="t in thumbs" :key="t.id">
  <button
    v-if="t.status === 'error'"
    type="button"
    aria-label="Retry upload"
    class="w-12 h-12 bg-[var(--color-raised)] rounded-[var(--radius-input)] overflow-hidden shrink-0 relative"
    @click="retryThumb(t)"
  >
    <img :src="t.blobUrl" class="w-full h-full object-cover" alt="" />
    <span
      class="absolute inset-0 bg-[var(--color-danger)]/60 flex items-center justify-center text-xs"
    >Retry</span>
  </button>
  <RouterLink
    v-else
    :to="t.itemId ? `/items/${t.itemId}` : ''"
    class="w-12 h-12 bg-[var(--color-raised)] rounded-[var(--radius-input)] overflow-hidden shrink-0 relative"
  >
    <img :src="t.blobUrl" class="w-full h-full object-cover" alt="" />
    <span
      v-if="t.status === 'uploading' || t.status === 'processing'"
      role="progressbar"
      :aria-valuenow="Math.round(t.progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      class="absolute inset-y-0 left-0 pointer-events-none transition-[width] duration-100"
      :style="{
        width: `${t.progress * 100}%`,
        backgroundColor: 'rgba(34, 197, 94, 0.35)',
      }"
    ></span>
  </RouterLink>
</template>
```

- [ ] **Step 6: Run the retry e2e — should pass**

```bash
cd apps/web && pnpm test:e2e camera-upload-retry.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/test/upload.test.ts \
        apps/web/src/pages/CameraView.vue \
        apps/web/e2e/camera-upload-retry.spec.ts
git commit -m "feat(camera): surface upload_failed, add retry button on errored thumbs"
```

---

## Task 5: Regression test — item appears in Unsorted after upload

This is the specific bug the user reported ("took a photo over and over, an hour later one appeared").

**Files:**
- Create: `apps/web/e2e/camera-db-first-visibility.spec.ts`
- Possibly modify: `apps/web/src/pages/UnsortedPage.vue` and/or router config (only if the test reveals the list is stale-cached)

- [ ] **Step 1: Write failing e2e**

Create `apps/web/e2e/camera-db-first-visibility.spec.ts`:

```ts
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

  // Dynamic unsorted list: empty until upload happens, then includes the item.
  // Override the default fixture route (fixtures.ts returns []).
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
  await input.setInputFiles({
    name: "v.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await page.waitForResponse("**/api/items/upload");

  // Navigate back then to unsorted (or directly — whatever the app's flow is).
  await page.getByRole("link", { name: /Back/i }).click();
  // Adjust route below to wherever unsorted lives in the app (likely "/" or "/unsorted").
  // Inspect apps/web/src/router/index.ts if unclear.
  await page.goto("/unsorted");

  await expect(page.getByText(/Processing\.\.\./i)).toBeVisible();
});
```

**Note for the implementer:** if the unsorted route path isn't `/unsorted`, inspect `apps/web/src/router/index.ts` or `apps/web/src/pages/UnsortedPage.vue` usage and correct the `page.goto` target.

- [ ] **Step 2: Run the test — may pass or fail depending on caching**

```bash
cd apps/web && pnpm test:e2e camera-db-first-visibility.spec.ts
```

If PASS: the existing `onMounted(fetchUnorganized)` hook plus normal Vue Router remounting is already sufficient — skip to Step 4.

If FAIL: the Unsorted page isn't refetching. Proceed to Step 3.

- [ ] **Step 3: If needed — force refetch on route entry**

Open `apps/web/src/pages/UnsortedPage.vue`. Find the existing `onMounted(fetchUnorganized)` call.

Add an `onActivated` hook alongside it:

```ts
import { onMounted, onActivated } from "vue";
// ... existing code ...
onMounted(fetchUnorganized);
onActivated(fetchUnorganized);
```

If there is no `<KeepAlive>` wrapping the route and the test still fails, check `apps/web/src/router/index.ts` for a `<router-view v-slot=... > <KeepAlive> ... </KeepAlive> </router-view>` pattern. If present, the `onActivated` hook above is the fix.

Alternative approach if neither works: watch the route path:

```ts
import { watch } from "vue";
import { useRoute } from "vue-router";
const route = useRoute();
watch(() => route.fullPath, () => { fetchUnorganized(); });
```

Re-run:

```bash
cd apps/web && pnpm test:e2e camera-db-first-visibility.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/camera-db-first-visibility.spec.ts
# Also stage UnsortedPage.vue only if Step 3 was needed:
git add apps/web/src/pages/UnsortedPage.vue 2>/dev/null || true
git commit -m "test(camera): regression — uploaded item visible in Unsorted after nav"
```

---

## Task 6: Full-suite sweep

**Files:** none required; fixes as discovered.

- [ ] **Step 1: Run all API tests**

```bash
cd apps/api && pnpm test
```

Expected: all green. If any test in `items.test.ts`, `queue.test.ts`, or `search.test.ts` references `status === "processing"` as the response status of `/upload`, update to `"uploading"` (or to whatever post-waitUntil state is asserted, settling via `waitOnExecutionContext` if needed).

- [ ] **Step 2: Run all Playwright e2e specs**

```bash
cd apps/web && pnpm test:e2e
```

Expected: all green. Specs to keep an eye on:
- `camera.spec.ts` — mock response shape updated in Task 3 Step 4.
- `upload-assignment.spec.ts` — may mock `/api/items/upload`; update shape to `status: "uploading"` if it asserts on the field.
- `unsorted.spec.ts` — if it asserts on specific `status` strings, ensure it still matches.

If any spec references `status: "processing"` as what the upload endpoint *returns*, change to `"uploading"`. If a spec fetches from `/api/items` and filters by status, leave it (the background waitUntil flips it to `processing` eventually).

- [ ] **Step 3: Manual smoke test**

```bash
pnpm dev
```

Open `http://localhost:5173` (or whichever port Vite reports), sign in, go to Camera, Continuous mode. Take 3 photos rapidly. Confirm:
- Each thumb shows a green bar filling left-to-right quickly.
- All three overlays reach ~full width within a second or two.
- Navigate Back → Items → Unsorted. All three rows are present with label `"Processing..."`.
- Within ~30s each resolves to an AI-labeled name.
- Throttle to Slow 3G (DevTools → Network), repeat. Upload bar takes visibly longer but completes; rows appear after each upload's 201.

- [ ] **Step 4: Final commit if any Task 6 fixes were made**

```bash
git status
# If changes:
git add <files>
git commit -m "test: align remaining specs with D1-first upload status values"
```

---

## Summary checklist

- [ ] Task 1 — `resizeAndCompress` utility + compression e2e
- [ ] Task 2 — `uploadWithProgress` utility + progress overlay + e2e
- [ ] Task 3 — D1-first API handler + `waitUntil` + API test updates
- [ ] Task 4 — `upload_failed` path + retry button + e2e
- [ ] Task 5 — Regression e2e that item appears in Unsorted after nav
- [ ] Task 6 — Full-suite sweep, smoke test, final commits
