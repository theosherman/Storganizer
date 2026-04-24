# DB-first photo upload with client-side compression and progress indicator

## Context

**Incident that prompted this.** At work, user snapped the same item several times because nothing appeared in the items list when they navigated back. They gave up thinking the app was broken. About an hour later, one of the attempts finally showed up; the others were effectively lost from the user's point of view.

**Root causes in the current flow** (verified in code):

- `apps/api/src/routes/items.ts:9-58` — `POST /api/items/upload` performs, in this order and all awaited before responding: R2 put, D1 insert of `items`, D1 insert of `item_photos`, queue enqueue, D1 readback. The item row does not exist until step 2, which only runs after the full blob has uploaded and R2 has accepted it.
- `apps/api/src/queue/consumer.ts` — AI labeling (`@cf/meta/llama-4-scout-17b-16e-instruct`) runs off-request, and is slow (5–15s typical). It's also batched by Cloudflare Queues, adding up to `max_batch_timeout` seconds of head-of-line delay.
- `apps/web/src/pages/CameraView.vue:53-78` — client holds open the full upload round-trip before the thumb can even transition to "processing." No compression is applied; continuous-mode captures are at video resolution with 0.9 JPEG quality, and native-mode captures are raw camera output (often several MB, sometimes HEIC).
- The Unsorted list fetches on mount only. Combined with the above, if a previous upload silently died mid-flight (flaky network, Worker CPU limits, client backgrounding the tab), no row is ever written and the user sees nothing on return.

**Intended outcome.** Tapping the shutter creates the D1 row as the first thing that happens, within ~200ms of the upload bytes arriving at the Worker. R2 put and AI labeling become best-effort background work. Client-side compression keeps uploads under ~250KB so mobile networks don't dominate latency. A green overlay progress indicator gives immediate, honest feedback on bytes-in-flight.

## Design

### Data flow

1. Shutter press.
2. Client compresses the captured blob via `resizeAndCompress(blob, { maxDim: 1024, quality: 0.8 })` → typically 80–180KB JPEG.
3. Client creates a `Thumb` with `status='uploading'`, `progress=0`, holds the compressed `Blob` for possible retry.
4. Client `POST`s multipart to `/api/items/upload` via `uploadWithProgress` (XHR-backed). `xhr.upload.onprogress` drives `thumb.progress` in `[0,1]`.
5. Worker parses multipart, validates `container_id`, mints `itemId`/`photoId`/`r2Key`, `INSERT`s `items` row with `status='uploading'`, `name='Processing...'`, responds 201 with the item. **This is the commit point.**
6. Worker runs the rest in `c.executionCtx.waitUntil(...)`: R2 `put`, `INSERT item_photos`, `QUEUE.send`, then `UPDATE items SET status='processing'`. Any failure → `UPDATE items SET status='upload_failed'`.
7. Queue consumer runs AI; on success `UPDATE items SET name=?, ai_label=?, status='ready'`; on failure `UPDATE items SET name='Unknown item', status='ready'` (unchanged).

### Status state machine

```
uploading → processing → ready         (happy path)
uploading → upload_failed              (waitUntil work threw)
processing → ready                     (AI labeled or fell back to 'Unknown item')
```

### Progress overlay

Thin `<span>` absolutely positioned over the thumb `<img>`, `role="progressbar"`, `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`. Background `rgba(34, 197, 94, 0.35)` (Tailwind green-500 at 35% opacity — tune to match the warm theme during visual verification; introduce a CSS var if useful), `width: progress*100%`. Visible while `status` is `'uploading'` or `'processing'` — at 100% the full thumb has the green tint, signaling "bytes left the phone, now waiting on server." Disappears on `'ready'`.

### Components and files to modify

**New — client utilities**
- `apps/web/src/lib/resizeAndCompress.ts` — `(blob: Blob, opts?: { maxDim?: number; quality?: number }) => Promise<Blob>`. Uses `createImageBitmap` → `HTMLCanvasElement` → `canvas.toBlob('image/jpeg', quality)`. Preserves EXIF orientation via `createImageBitmap({ imageOrientation: 'from-image' })`. Defaults `maxDim=1024`, `quality=0.8`.
- `apps/web/src/lib/uploadWithProgress.ts` — `(url: string, formData: FormData, opts: { onProgress?: (p: number) => void; signal?: AbortSignal }) => Promise<Response-like>`. XHR wrapper returning `{ ok, status, json() }`. Hooks `upload.onprogress`, resolves on `load`, rejects on `error`/`abort`/non-2xx.

**Modify — `apps/web/src/pages/CameraView.vue`**
- `Thumb` interface gains `progress: number` and `blob: Blob`.
- `uploadBlob` flow: `resizeAndCompress` → build FormData → `uploadWithProgress` with `onProgress: p => thumb.progress = p` → status transitions.
- Template: add progress overlay span inside the thumb `<RouterLink>`, with `role="progressbar"` and `aria-valuenow`. Tapping an errored thumb re-invokes `uploadBlob(thumb.blob, ...)`.
- Keep optimistic thumb insertion (CameraView.vue:55-61) unchanged.

**Modify — `apps/api/src/routes/items.ts`**
- Rewrite `POST /upload` handler per "Data flow" above.
- `INSERT items` becomes the commit point; respond 201 immediately after.
- `c.executionCtx.waitUntil(async () => { … R2.put → INSERT item_photos → QUEUE.send → UPDATE status='processing'; catch → UPDATE status='upload_failed' })`.
- `GET /` handler needs no change; `upload_failed` falls through the same query.

**Modify — schema / types**
- Check `apps/api/src/db/` (or wherever migrations live) for any `CHECK` constraint on `items.status`. If present, add `'upload_failed'` to the allowed set via a new migration. If status is unconstrained text, no migration — update any TS union types for `Item.status` wherever defined.

**Verify — Unsorted list refresh**
- Read `apps/web/src/pages/UnsortedPage.vue` and the router config. With D1-first the row is live before the user can navigate, so existing `onMounted(fetchUnorganized)` should suffice *if* Vue Router actually remounts the page. If `<KeepAlive>` is in play, add `onActivated(fetchUnorganized)` or a `watch(route, fetchUnorganized)`.

**Reuse, don't recreate**
- `ulid()` at `apps/api/src/lib/ulid.ts` for IDs.
- Existing composables `useContainers`, `useLocations`, `useDefaults`, `useItems` — untouched.
- Existing Hono + Env + AuthVariables patterns in `apps/api/src/routes/items.ts`.
- Existing API test infrastructure in `apps/api/test/` (`helpers.ts`, `upload.test.ts` — extend the latter rather than creating a parallel `items-upload.test.ts`).
- Existing Playwright fixtures in `apps/web/e2e/fixtures.ts` and the `camera.spec.ts` camera-stream stub — reuse those instead of inventing a new fixture.

### Error handling

- **Upload-time (XHR)** — network / 4xx / 5xx / abort → `thumb.status='error'`. No D1 row exists yet; no cleanup. Tap thumb to retry with the retained blob.
- **Post-response (`waitUntil`)** — any failure flips row to `status='upload_failed'`. Camera thumb does not live-update (scope decision); user sees the failed state next time the list rerenders.
- **AI failure** — unchanged; row ends at `status='ready'` with name `'Unknown item'`.
- **Unmount mid-upload** — let in-flight XHRs continue. Worker still inserts the row.
- **Rapid shutters** — each press is an independent `uploadBlob`. Parallel uploads, independent progress bars. Thumb strip cap of 5 is cosmetic only; uploads continue.

### Testing (TDD — write tests first)

**Unit (`apps/web`, vitest)**
- `resizeAndCompress.test.ts` — fixture JPEG (large synthetic asset), assert longest edge ≤ 1024, `size < 250_000`, `type === 'image/jpeg'`, respects non-default args.
- `uploadWithProgress.test.ts` — stub `XMLHttpRequest` (`vi.stubGlobal`); assert `onProgress` fires in `[0,1]`, resolves on 201 with parsed JSON, rejects on 4xx/5xx/network error, `AbortSignal` triggers `xhr.abort()` and rejection.

**API (`apps/api`, extend `apps/api/test/upload.test.ts`)**
- New cases: POST multipart; response 201 arrives with `item.status='uploading'`; D1 row exists at that moment; after `waitUntil` settles, status `'processing'`, `item_photos` row exists, queue has one message; forced R2 failure flips row to `'upload_failed'` and no queue message is sent.

**Playwright e2e (`apps/web/e2e/`)**
- Extend `camera.spec.ts` or add `camera-db-first.spec.ts` — mock `/api/items/upload` with ~1s delay; tap shutter; assert thumb appears instantly with `[role="progressbar"]`; `aria-valuenow` increases monotonically; navigate to Unsorted; item is present with processing-state label. **Regression for the original incident.**
- `camera-upload-retry.spec.ts` — mock upload to fail once then succeed; first tap yields error state; tapping the error thumb retries and succeeds.
- `camera-compression.spec.ts` — intercept the upload request, assert POST body size is under ~250KB even when capture source provides a large image.

**TDD order**
1. Write all e2e specs (red).
2. Write unit tests for both client utilities (red).
3. Extend `upload.test.ts` API cases (red).
4. Implement: `resizeAndCompress` → `uploadWithProgress` → `CameraView.vue` wiring → API handler rewrite → schema tweak if needed → Unsorted refresh verification.
5. Full suite green, no regressions in existing e2e specs (`camera.spec.ts`, `upload-assignment.spec.ts`, etc.).

## Verification

End-to-end manual check once implementation is green:
1. `pnpm --filter web dev` and `pnpm --filter api dev` (or whichever scripts exist) — smoke the full stack locally.
2. Open the app on a phone (or desktop camera), tap Continuous, snap 3 photos in rapid succession. Expect: three thumbs, each with a green overlay filling left-to-right, all overlays reaching 100% within seconds.
3. Navigate Back → items/unsorted. Expect all three rows present with `Processing...` labels. Within 30s each resolves to an AI-labeled name.
4. Throttle network to "Slow 3G" in DevTools, repeat step 2. Expect rows still appear in the list within seconds of the upload completing; green overlay advances visibly during the upload.
5. Block `/api/items/upload` in DevTools (or kill the API mid-upload). Expect thumb flips to error; tapping it retries successfully once the API is back.
6. Run full test suite: `pnpm test` (unit + API) and `pnpm --filter web e2e` (Playwright). All green.
