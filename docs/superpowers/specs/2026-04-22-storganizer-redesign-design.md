# Storganizer redesign — 2 screens, warm minimal theme, continuous camera

Date: 2026-04-22
Supersedes (UX scope only): `2026-04-11-storganizer-design.md`. Backend architecture from the original spec stays intact.

## Goal

Condense the UI to two primary screens plus a dedicated camera screen. Replace the current indigo-on-light theme with a warm-minimal dark theme. Drop containers and locations as standalone screens — surface them as editable comboboxes that create-on-the-fly and stick as the device default until changed.

## Non-goals

- No backend schema changes.
- No offline queue.
- No visual-companion prototyping (terminal-only design per project preference).
- No bulk-select on Unsorted (rows sort individually with sticky defaults so bulk is unnecessary).

## Routes

Kept:
- `/` — Search
- `/unsorted` — Unsorted
- `/items/:id` — Item detail (redesigned; still reachable via tap from cards)
- `/login` — Login (theme updates only)

New:
- `/camera` — Camera screen

Removed:
- `/containers`, `/containers/:id`
- `/locations`, `/locations/:id`
- `/add` (old file-upload page; replaced by `/camera`)

Corresponding page files are deleted: `ContainersPage.vue`, `ContainerDetailPage.vue`, `LocationsPage.vue`, `LocationDetailPage.vue`, `AddItemsPage.vue`. `PhotoUploader.vue` is also deleted (superseded by `CameraView.vue`).

## Theme — warm minimal

Defined as Tailwind 4 `@theme` tokens in `apps/web/src/assets/main.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#0f0e0c` | Page background |
| `--color-surface` | `#1c1a17` | Card surfaces |
| `--color-raised` | `#2a2622` | Inputs, menus, popovers |
| `--color-border` | `#332e28` | Borders (hairline elevation) |
| `--color-text` | `#efe9e0` | Primary text (cream) |
| `--color-muted` | `#a79b8c` | Secondary / helper text |
| `--color-accent` | `#d97706` | Terracotta; CTAs, focus rings, FAB |
| `--color-accent-hover` | `#b45309` | Accent pressed/hover |
| `--color-danger` | `#dc2626` | Destructive states |

Radii: 4px inputs/buttons, 6px cards. No drop shadows — elevation comes from borders. Font: `system-ui, -apple-system, sans-serif`. No indigo / blue anywhere in the app.

## Navigation

**Top bar** (on Search, Unsorted, Item Detail):
- Left: "Storganizer" wordmark (text-only, accent color)
- Center: segmented tab switcher — Search | Unsorted
- Right: avatar circle → dropdown menu with Logout

**Camera FAB** (`CameraFab.vue`): 56px circular button, accent fill, camera glyph, fixed bottom-right (16px inset), shown on Search and Unsorted only. Routes to `/camera`.

**Camera screen** is full-bleed — uses its own header with a back arrow and mode toggle; no top bar.

Login uses a standalone centered layout.

## Components

New:
- `AppHeader.vue` — top bar (replaces `AppSidebar.vue`)
- `CameraFab.vue` — floating action button
- `EntityCombobox.vue` — shared combobox for containers and locations
- `UnsortedCard.vue` — row with inline name input, container/location comboboxes, Sort button
- `CameraView.vue` — the `/camera` page content

Redesigned:
- `ItemCard.vue`
- `SearchPage.vue`
- `UnsortedPage.vue`
- `ItemDetailPage.vue`
- `LoginPage.vue` (theme only)

Deleted:
- `AppSidebar.vue`
- `PhotoUploader.vue`
- `ContainersPage.vue`, `ContainerDetailPage.vue`, `LocationsPage.vue`, `LocationDetailPage.vue`, `AddItemsPage.vue`

## EntityCombobox

Wraps Reka UI's `Combobox` primitive for accessibility (keyboard nav, ARIA) without inherited styles.

Props:
- `list: Entity[]` — existing entities (`{ id, name }`)
- `modelValue: string | null` — selected id
- `entityLabel: string` — "container" / "location", used in placeholders and the create option

Emits:
- `update:modelValue(id: string | null)`
- `created(entity: Entity)` — fires when a brand-new entity was created

Behavior:
- Typing filters by case-insensitive substring.
- Arrow keys navigate; Enter selects the highlighted option.
- If the typed value has no exact name match, a sticky "+ Create '<typed>'" option appears at the bottom. Selecting it:
  1. POSTs to `/api/containers` or `/api/locations` with `{ name: typed }`
  2. On success, emits `created` with the returned row, then emits `update:modelValue` with the new id
  3. On failure, shows an inline error under the field and reverts to the previous selection
- Every successful selection (existing or newly created) also writes to `useLocalStorage('default-container' | 'default-location', id)` so the device default moves forward.

## Defaults (device-local)

Stored via `@vueuse/core`'s `useLocalStorage`:

| Key | Purpose |
| --- | --- |
| `default-container` | Last-selected container id (used to prefill new items) |
| `default-location` | Last-selected location id |
| `camera-mode` | `"continuous"` or `"native"` |

Defaults are prefilled into the Camera screen's container/location dropdowns and applied to each uploaded photo. If either is null (first use), photos go to Unsorted. Once a default is set, subsequent camera uploads are pre-sorted.

Defaults are per-device by design — no server-side user-default storage, no DB migration.

## Camera screen

Full-bleed page. Mobile portrait reference layout (desktop lays out the same, webcam-sized):

```
┌──────────────────────────────────────┐
│ ← Back             [Continuous|Native]│  translucent strip
│                                      │
│ Container: [Garage Bin 3 ▾]          │
│ Location:  [Garage ▾]                │
│                                      │
│           LIVE VIEWFINDER            │  (or Native tile)
│                                      │
│  [thumb] [thumb] [thumb] [thumb]     │
│                                      │
│                         [ ● shutter ]│  bottom-right
└──────────────────────────────────────┘
```

**Continuous mode:**
- `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` streamed to a `<video>` element
- Shutter: draws the current frame to a canvas → `toBlob` → POSTs to `/api/items/upload` with the default `container_id` / `location_id` attached
- Viewfinder stays active after capture; user can shoot again immediately

**Native mode:**
- Hidden `<input type="file" accept="image/*" capture="environment">` stands in for the viewfinder area
- Shutter triggers the input; on change, the file is POSTed with defaults
- Each tap is one shot (no auto-chaining)

**Mode toggle:**
- Segmented "Continuous | Native" pill in the top strip
- Value stored in `useLocalStorage('camera-mode', 'continuous')`
- If `getUserMedia` rejects (permission denied, no camera, unsupported browser), auto-switch to Native and disable the Continuous button with a tooltip explaining why

**Filmstrip:**
- Last ~5 uploads, most recent first
- Per-thumbnail status dot: uploading (spinner), processing (pulse, AI still labeling), ready (none), error (red dot with retry affordance)
- Tap a thumbnail → `/items/:id`

## Search & Unsorted

**Search (`/`):**
- Container max-width 720px, centered
- Search input up top (full-width, raised surface, focus ring uses accent)
- Vertical list of `ItemCard`s — photo, name, "container → location" or "Unsorted" in muted
- Tap → item detail

**Unsorted (`/unsorted`):**
- Same max-width, heading "Unsorted · N"
- Vertical list of `UnsortedCard`s. Each row:
  - Thumbnail (left)
  - Editable name input (pre-filled with AI-suggested name, muted "Identifying…" while processing)
  - `EntityCombobox` for container (prefilled with device default)
  - `EntityCombobox` for location (prefilled with device default)
  - "Sort it" button — PATCHes the item with current field values, removes the row on success

## Item Detail (`/items/:id`)

Redesigned for the warm palette. Full-size photo at top. Below: editable name input, container combobox, location combobox, Save button, Delete button (danger color). Back returns to wherever the user came from.

## API

No schema changes. Existing endpoints:
- `GET /api/containers`, `POST /api/containers` — combobox list + create
- `GET /api/locations`, `POST /api/locations` — combobox list + create
- `POST /api/items/upload` — extended to accept optional `container_id` and `location_id` form fields; when present, the new item is created with those assignments (not Unsorted)
- `PATCH /api/items/:id` — used by Unsorted card save, Item Detail save
- `DELETE /api/items/:id` — used by Item Detail
- `GET /api/items?q=…` — search
- `GET /api/items?unsorted=true` — Unsorted page (add this filter if it doesn't already exist; verify during implementation)

The only backend change is the upload-endpoint extension for container/location assignment.

## Error handling

- Camera permission denied → inline banner on Camera screen; auto-switch to Native; Continuous toggle disabled with tooltip
- Upload failure → thumbnail shows red dot, tap to retry (re-POST same blob)
- Combobox create failure → inline error under the field; previous selection restored
- Offline / network error → existing auth-store handling; no offline queue in scope
- Unauthorized (401) from any API call → redirect to `/login`

## Testing (TDD, Playwright e2e)

All tests live under `apps/web/e2e/`. Tests are written before each component is implemented, per the project's TDD requirement. Existing tests for removed pages are deleted.

New / revised specs:
- `theme.spec.ts` — asserts dark background and accent color on key surfaces; asserts no indigo/blue values in computed styles
- `navigation.spec.ts` — top-bar tabs route correctly; FAB routes to `/camera`; removed routes (`/containers`, `/locations`, `/add`) 404 or redirect
- `combobox.spec.ts` — list existing, filter, create new via the sticky option, selection writes through to localStorage default
- `camera.spec.ts` — mode toggle persists in localStorage; Native-mode fallback when `navigator.mediaDevices.getUserMedia` is mocked to reject; uploaded photo appears in filmstrip; clicking thumbnail routes to item detail
- `unsorted.spec.ts` — unsorted list renders; inline name + comboboxes prefill with defaults; "Sort it" PATCHes and row disappears
- `defaults.spec.ts` — setting a container in the combobox stores localStorage default; subsequent camera upload carries that container; item appears in Search (not Unsorted)
- `item-detail.spec.ts` — edit name, change container/location, save, delete

Continuous-mode live-stream capture is not end-to-end testable in Playwright (requires a real camera). Coverage for that path stops at: toggle persistence, fallback behavior on `getUserMedia` rejection, and upload success with a mocked `MediaStream` / blob.

## Dependencies to add

- `@vueuse/core` — `useLocalStorage` (camera-mode, default-container, default-location)
- `reka-ui` — accessible Combobox primitive

## Files touched (implementation-plan input)

New files:
- `apps/web/src/components/AppHeader.vue`
- `apps/web/src/components/CameraFab.vue`
- `apps/web/src/components/EntityCombobox.vue`
- `apps/web/src/components/UnsortedCard.vue`
- `apps/web/src/pages/CameraView.vue`
- `apps/web/src/composables/useContainers.ts` (if not already present — wraps `/api/containers`)
- `apps/web/src/composables/useLocations.ts` (ditto for `/api/locations`)
- `apps/web/src/composables/useDefaults.ts` (thin wrapper around the three `useLocalStorage` keys)
- `apps/web/e2e/theme.spec.ts`, `navigation.spec.ts`, `combobox.spec.ts`, `camera.spec.ts`, `unsorted.spec.ts`, `defaults.spec.ts`, `item-detail.spec.ts`

Modified files:
- `apps/web/src/App.vue` — replace `AppSidebar` with `AppHeader` + render FAB conditionally
- `apps/web/src/router/index.ts` — drop removed routes, add `/camera`
- `apps/web/src/assets/main.css` — add `@theme` tokens
- `apps/web/src/pages/SearchPage.vue`, `UnsortedPage.vue`, `ItemDetailPage.vue`, `LoginPage.vue` — rewrite against new theme + structure
- `apps/web/src/components/ItemCard.vue` — warm palette
- `apps/web/package.json` — add `@vueuse/core`, `reka-ui`
- `apps/api/src/routes/items.ts` — accept `container_id` / `location_id` on `POST /upload`; verify `?unsorted=true` filter on `GET /`

Deleted files:
- `apps/web/src/components/AppSidebar.vue`
- `apps/web/src/components/PhotoUploader.vue`
- `apps/web/src/pages/ContainersPage.vue`, `ContainerDetailPage.vue`, `LocationsPage.vue`, `LocationDetailPage.vue`, `AddItemsPage.vue`
- Any Playwright specs targeting the deleted pages

## Rollout

Single branch. Done in one pass because the theme change touches every visible page anyway — phasing would mean two themes coexisting.
