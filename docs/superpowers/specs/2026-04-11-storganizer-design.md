# Storganizer — Design Spec

## Context

Storganizer is a personal storage organization app for tracking physical items across containers and locations. The core problem: you put things in bins, the bins go on shelves, and months later you can't remember where anything is.

The workflow is designed around two distinct phases:
1. **Capture** — quickly snap photos of items before boxing them up. An LLM identifies each item automatically so you don't have to stop and type labels.
2. **Organize & Find** — later, review auto-labeled items, fix any wrong labels, assign items to containers, assign containers to locations, and search for anything you've stored.

## Tech Stack

| Layer | Technology | Cloudflare Service |
|-------|-----------|-------------------|
| Frontend | Vue 3 + Vite + Tailwind CSS | Cloudflare Pages |
| Backend | Hono | Cloudflare Worker |
| Database | SQL | Cloudflare D1 |
| File Storage | Object storage | Cloudflare R2 |
| AI | Image identification | Workers AI (LLaVA) |
| Auth | Google OAuth | Worker handles OAuth flow |
| Async Processing | Background jobs | Cloudflare Queues |

**Monorepo structure** using pnpm workspaces:

```
storganizer/
├── apps/
│   ├── web/                # Vue 3 + Vite → Cloudflare Pages
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   ├── pages/
│   │   │   ├── router/
│   │   │   ├── stores/
│   │   │   ├── App.vue
│   │   │   └── main.ts
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── api/                # Hono → Cloudflare Worker
│       ├── src/
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── db/
│       │   │   ├── schema.sql
│       │   │   └── migrations/
│       │   ├── queue/
│       │   └── index.ts
│       ├── wrangler.toml
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
└── turbo.json              # Optional build orchestration
```

## Data Model

### Entity Hierarchy

```
User
 ├── Location (e.g. "Attic", "Garage Shelf B")
 │    └── Container (e.g. "Blue Bin #3", "Small Parts Drawer")
 │         └── Item (e.g. "USB-C Cable", "Arduino Nano")
 │              └── Item Photo (one or more photos per item)
 └── (Unassigned containers and items exist outside the hierarchy)
```

### Tables

**users**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (ULID) | Primary key |
| google_id | TEXT | Unique, from Google OAuth |
| email | TEXT | Unique |
| name | TEXT | Display name from Google |
| avatar_url | TEXT | Profile photo URL |
| role | TEXT | 'admin' or 'member' |
| invited_by | TEXT | FK to users.id, nullable |
| created_at | TEXT | ISO 8601 timestamp |

**allowed_emails**
| Column | Type | Notes |
|--------|------|-------|
| email | TEXT | Primary key, invited email |
| invited_by | TEXT | FK to users.id |
| created_at | TEXT | ISO 8601 timestamp |

**locations**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (ULID) | Primary key |
| user_id | TEXT | FK to users.id |
| name | TEXT | e.g. "Attic", "Garage Shelf B" |
| description | TEXT | Optional notes |
| created_at | TEXT | ISO 8601 timestamp |

**containers**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (ULID) | Primary key |
| user_id | TEXT | FK to users.id |
| location_id | TEXT | FK to locations.id, nullable |
| name | TEXT | e.g. "Blue Bin #3" |
| description | TEXT | Optional notes |
| created_at | TEXT | ISO 8601 timestamp |

**items**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (ULID) | Primary key |
| user_id | TEXT | FK to users.id |
| container_id | TEXT | FK to containers.id, nullable |
| name | TEXT | User-facing name (editable) |
| ai_label | TEXT | Original LLM suggestion, preserved |
| description | TEXT | Optional notes |
| status | TEXT | 'processing' or 'ready' |
| created_at | TEXT | ISO 8601 timestamp |

**item_photos**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT (ULID) | Primary key |
| item_id | TEXT | FK to items.id |
| r2_key | TEXT | Full-size image key in R2 |
| thumbnail_url | TEXT | Generated via Cloudflare Image Transforms, nullable |
| created_at | TEXT | ISO 8601 timestamp |

### Key Design Decisions

- **Nullable foreign keys** — `container_id` on items and `location_id` on containers are nullable. This enables the "unsorted" workflow: items exist without a container, containers exist without a location.
- **Separate `ai_label` and `name`** — When the AI identifies an item, both fields are set to the AI's guess. The user can edit `name` without losing the original AI label.
- **ULID primary keys** — Sortable, URL-safe, no auto-increment coordination needed.
- **Multi-photo items** — An item can have multiple photos (e.g. front and back of a device, close-up of a label).

## Authentication

### Flow

1. User clicks "Sign in with Google" on the frontend
2. Frontend redirects to Google's OAuth consent screen
3. Google redirects back to `/api/auth/google/callback` with an authorization code
4. Worker exchanges the code for Google tokens, extracts email/name/avatar
5. Worker checks `allowed_emails` table — if the email isn't listed, return 403
6. Worker creates or updates the user record in D1
7. Worker issues a signed JWT and sets it as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie
8. Frontend redirects to the app

### Invite System

- The initial admin email is configured via a `ADMIN_EMAIL` environment variable in `wrangler.toml`. The first login from that email automatically gets `role: admin`.
- Admins can add emails to `allowed_emails` via `POST /api/admin/invite`
- When an invited user signs in with Google, their account is created automatically

### Middleware

Hono middleware on all `/api/*` routes (except auth routes):
- Extract JWT from cookie
- Verify signature
- Attach user to request context
- Return 401 if invalid/missing

## Image Processing Pipeline

### Upload Flow

1. Frontend captures photo(s) via `<input type="file" accept="image/*" capture="environment">` or file picker
2. Frontend sends each image to `POST /api/items/upload` as `multipart/form-data`
3. Worker:
   a. Generates a ULID for the item and photo
   b. Uploads image to R2 under `{user_id}/{item_id}/{photo_id}.jpg`
   c. Thumbnails are generated on-read via Cloudflare Image Transformations (R2 public bucket with transform URL params) rather than at upload time. This avoids image processing in the Worker.
   d. Creates item record in D1 with `status: 'processing'`
   e. Creates item_photo record in D1
   f. Publishes a message to the Cloudflare Queue with `{ item_id, photo_r2_key }`
   g. Returns the item (with `status: 'processing'`) to the frontend immediately

### Queue Consumer

1. Receives message with `item_id` and `photo_r2_key`
2. Fetches the image from R2
3. Calls Workers AI with the LLaVA model, prompt: "What is this object? Provide a short, specific label (e.g. 'USB-C to Lightning cable' or 'Arduino Nano microcontroller'). Just the label, nothing else."
4. Updates item in D1: sets `ai_label` and `name` to the AI's response, sets `status: 'ready'`

### Error Handling

- If Workers AI fails, set `status: 'ready'` with `ai_label: null` and `name: 'Unknown item'`
- User can always manually edit the name regardless of AI success

## API Routes

All routes prefixed with `/api`. Auth middleware on all except `/api/auth/*`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | /auth/google | Redirect to Google OAuth |
| GET | /auth/google/callback | Handle OAuth callback |
| GET | /auth/me | Get current user |
| POST | /auth/logout | Clear auth cookie |

### Items
| Method | Path | Description |
|--------|------|-------------|
| GET | /items | List/search items. Query params: `q` (search), `status`, `unorganized` (no container) |
| POST | /items/upload | Upload photo and create item |
| GET | /items/:id | Get item with photos |
| PATCH | /items/:id | Update name, description, container_id |
| DELETE | /items/:id | Delete item and its photos from R2 |

### Containers
| Method | Path | Description |
|--------|------|-------------|
| GET | /containers | List containers. Query params: `location_id`, `q` |
| POST | /containers | Create container |
| GET | /containers/:id | Get container with its items |
| PATCH | /containers/:id | Update name, description, location_id |
| DELETE | /containers/:id | Delete container (items become unassigned) |

### Locations
| Method | Path | Description |
|--------|------|-------------|
| GET | /locations | List locations |
| POST | /locations | Create location |
| GET | /locations/:id | Get location with its containers |
| PATCH | /locations/:id | Update name, description |
| DELETE | /locations/:id | Delete location (containers become unassigned) |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | /admin/invite | Add email to allow-list |
| GET | /admin/invites | List invited emails |
| DELETE | /admin/invite/:email | Remove from allow-list |

## Frontend

### Navigation & Layout

**Sidebar navigation** (collapsible to hamburger on mobile):
- Search (default view, home page)
- Unsorted Items (items with no container)
- Containers (list of all containers)
- Locations (list of all locations)
- Add Items (camera/upload button, prominent)

On mobile, the sidebar collapses to a hamburger menu. The "Add Items" action remains easily accessible.

### Pages

**Search (Home)**
- Large search input at the top
- Results appear as a list of item cards
- Each card shows: thumbnail, item name, breadcrumb trail (`Container → Location`)
- Empty state encourages adding items
- Search queries `GET /api/items?q=...`

**Unsorted Items**
- Grid/list of items with `container_id = null`
- Each item shows thumbnail, name (or "Processing..." if status is processing)
- Quick-assign action: tap an item to assign it to a container
- Batch operations: select multiple items and assign to same container

**Containers**
- List of containers, grouped by location (or "No location" group)
- Each container shows name, item count, location
- Click to see contents (items in that container)
- Create new container with name and optional location assignment

**Locations**
- List of locations with container count
- Click to see containers at that location
- Create new location

**Add Items (Camera/Upload)**
- Opens camera or file picker
- Supports selecting multiple photos at once
- Shows upload progress for each photo
- Newly uploaded items appear with "Processing..." status
- Status updates to show the AI label once processing completes

**Item Detail**
- Shows all photos for the item (full size)
- Editable name field (pre-filled with AI label)
- AI label shown separately as reference
- Container assignment (dropdown or search)
- Description field
- Delete action

### Styling

- Tailwind CSS
- Auto dark/light theme following `prefers-color-scheme`
- Clean, functional aesthetic — this is a utility app

### State Management

- Vue 3 Composition API with `<script setup>`
- Pinia for global state (auth user, current search query)
- Composables for data fetching (items, containers, locations)
- Vue Router for page navigation

## Search

D1 full-text search using `LIKE` queries across:
- `items.name`
- `items.ai_label`
- `items.description`
- `containers.name`
- `locations.name`

Query joins items with their containers and locations to return the breadcrumb trail in a single query. Results are ordered by relevance (exact match > starts with > contains).

## Testing Strategy

### Approach: Test-Driven Development (TDD)

All features are built test-first. Write failing tests, then implement to make them pass.

### API Tests (Vitest)

Unit/integration tests for Hono API routes using Cloudflare's `unstable_dev` or miniflare for local D1/R2/Queue bindings.

1. Auth: JWT issuance, validation, cookie handling, allow-list enforcement
2. Items CRUD: create via upload, read, update name/container, delete with R2 cleanup
3. Containers CRUD: create, assign location, delete cascades (items become unassigned)
4. Locations CRUD: create, delete cascades (containers become unassigned)
5. Search: query matching across items/containers/locations, breadcrumb assembly
6. Queue consumer: AI label processing, error handling fallback to "Unknown item"
7. Admin: invite management, role-based access

### E2E Tests (Playwright)

Full browser tests against a running local dev environment.

1. **Auth flow** — Google OAuth login (mocked provider), redirect to app, session persistence
2. **Photo capture** — Upload image, see "Processing..." status, see AI label appear
3. **Item management** — Edit name, assign to container, view in container
4. **Container management** — Create container, assign to location, view items inside
5. **Location management** — Create location, see containers listed
6. **Search** — Search by name, AI label, description; verify breadcrumb trail in results
7. **Unsorted items** — Upload without assigning, see in unsorted list, batch assign
8. **Responsive layout** — Sidebar visible on desktop, hamburger on mobile viewport
9. **Dark/light mode** — Follows system preference

### Cross-device Verification
10. Mobile browser: sidebar collapses, camera capture works
11. Desktop browser: sidebar visible, file upload works
