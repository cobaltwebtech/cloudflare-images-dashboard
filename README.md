# Cloudflare Images Dashboard

A full-stack dashboard for managing [Cloudflare Images](https://www.cloudflare.com/products/cloudflare-images/) — upload, browse, search, organize, and configure images stored in your Cloudflare account. Built with **TanStack Start**, deployed as a **Cloudflare Worker**, with **D1** for local caching and metadata.

## Features

- **Upload** images via drag-and-drop or URL import with optional metadata and signed-URL settings
- **Browse & Search** images in grid or table view with pagination
- **Filter** by client and hierarchical folder with a tree sidebar
- **Folders** — create, rename, move, and delete nested folders with cascade updates
- **Clients** — group images by customer/client with auto-linking via Cloudflare `creator` field
- **Variants** — manage image transformation presets (resize, crop, fit modes)
- **Signing Keys** — create and manage keys for private/signed image URLs
- **Bulk Operations** — select multiple images and assign folders or clients in one action
- **Local Cache** — sync images from the Cloudflare API into D1 for fast filtering and querying
- **Dark Mode** — toggle between light and dark themes

## Tech Stack

| Category | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, SSR) |
| Routing | [TanStack Router](https://tanstack.com/router) (file-based) |
| Data Fetching | [TanStack React Query](https://tanstack.com/query) + Server Functions |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) |
| Icons | [Phosphor Icons](https://phosphoricons.com/) |
| Validation | [Zod](https://zod.dev/) v4 |
| Linting/Formatting | [Biome](https://biomejs.dev/) |
| Testing | [Vitest](https://vitest.dev/) |
| Deployment | [Cloudflare Workers](https://developers.cloudflare.com/workers/) via Wrangler |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React 19 (SSR)                    │
│  TanStack Router · TanStack Query · shadcn/ui       │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              TanStack Start Server Functions          │
│  (run inside Cloudflare Worker)                      │
└──────────┬──────────────────────────────┬────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐      ┌────────────────────────┐
│   Cloudflare D1 DB   │      │  Cloudflare Images API │
│   (Drizzle ORM)      │      │  (cloudflare npm SDK)  │
│                      │      │                        │
│  · images_cache      │      │  · Upload/Delete       │
│  · clients           │      │  · List/Variants       │
│  · folders           │      │  · Signing Keys        │
│  · custom_tags       │      │                        │
└──────────────────────┘      └────────────────────────┘
```

### Data Flow

1. Client components call **TanStack Query** hooks
2. Hooks invoke **TanStack Start Server Functions** (`createServerFn`)
3. Server Functions access typed Worker bindings via `getServerCtx()`
4. Operations hit **D1** (via Drizzle) or the **Cloudflare Images API**
5. Results flow back through React Query's cache to the UI

### Local Cache Pattern

Images are synced from the Cloudflare API into a local D1 cache for fast querying. This avoids paginating the Cloudflare API on every page load.

- **Manual sync**: Click the sync button on the Images page
- **Auto-sync**: Throttled to once every 30 minutes (tracked via localStorage)
- **Smart upsert**: Skips writes for unchanged images; preserves locally-managed fields (folder, client)
- **Auto-linking**: Matches images to clients via the Cloudflare `creator` field

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) package manager
- A [Cloudflare account](https://dash.cloudflare.com/) with Cloudflare Images enabled

### Environment Setup

1. **Clone the repository** and install dependencies:

```bash
pnpm install
```

2. **Create a `.dev.vars` file** in the project root with your Cloudflare credentials:

```env
CF_API_TOKEN="cfat_..."
CF_ACCOUNT_ID="your-account-id"
CF_IMAGES_HASH="your-images-hash"
```

- **`CF_API_TOKEN`**: A Cloudflare API token with Images and D1 read/write permissions. [Create one here](https://dash.cloudflare.com/profile/api-tokens).
- **`CF_ACCOUNT_ID`**: Your Cloudflare account ID (found in the right sidebar of the dashboard).
- **`CF_IMAGES_HASH`**: The account hash used in image delivery URLs (`imagedelivery.net/{hash}/{imageId}/...`). Found in the Cloudflare Images dashboard.

3. **Run database migrations** to create local D1 tables:

```bash
pnpm db:migrate
```

4. **Start the development server**:

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

## Project Structure

```
cloudflare-images-dashboard/
├── src/
│   ├── routes/              # File-based routes (TanStack Router)
│   │   ├── __root.tsx       # Root layout (sidebar, header, theme)
│   │   ├── index.tsx        # Dashboard landing page
│   │   ├── upload.tsx       # Image upload page
│   │   ├── images.index.tsx # Images list (grid/table, filter, bulk edit)
│   │   ├── images.$imageId.tsx # Image detail page
│   │   ├── folders.tsx      # Folder tree management
│   │   ├── clients.index.tsx     # Clients list
│   │   ├── clients.$clientId.tsx # Client detail
│   │   ├── variants.tsx     # Variant management
│   │   └── signing-keys.tsx # Signing keys management
│   ├── server/
│   │   ├── _ctx.ts          # Server context (bindings, SDK, DB)
│   │   ├── _utils.ts        # Shared server utilities
│   │   └── *.ts             # Server functions for each domain
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   └── *.tsx            # Application components
│   ├── db/
│   │   ├── db-schema.ts     # Drizzle schema definitions
│   │   └── index.ts         # Database client exports
│   ├── lib/
│   │   └── cf-url.ts        # Cloudflare image URL builder
│   └── styles.css           # Global styles + Tailwind imports
├── drizzle/                 # SQL migrations
├── wrangler.jsonc           # Cloudflare Worker configuration
├── vite.config.ts           # Vite configuration
├── drizzle.config.ts        # Drizzle Kit configuration
├── biome.json               # Biome linting/formatting config
└── components.json          # shadcn/ui configuration
```

## Database Schema

### `images_cache`
Local cache of Cloudflare Images with app-specific metadata.

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Cloudflare image ID |
| `filename` | TEXT | Original filename |
| `meta` | TEXT (JSON) | Image metadata |
| `require_signed_urls` | INTEGER | Whether signed URLs are required |
| `uploaded_at` | TEXT | Upload timestamp |
| `creator` | TEXT | Cloudflare creator identifier |
| `variants` | TEXT (JSON) | Available variant names |
| `client_id` | TEXT (FK) | Linked client (nullable) |
| `folder_id` | TEXT (FK) | Linked folder (nullable) |
| `folder_path` | TEXT | Denormalized folder path |
| `last_synced_at` | TEXT | Last sync timestamp |

### `clients`
Customer/client profiles for grouping images.

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Generated ID (nanoid) |
| `name` | TEXT | Client display name |
| `domain` | TEXT | Client domain |
| `description` | TEXT | Optional description |
| `color` | TEXT | Hex color swatch |
| `creator` | TEXT (unique) | Cloudflare creator value for auto-linking |
| `created_at` | TEXT | Creation timestamp |

### `folders`
Hierarchical folder tree.

| Column | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Generated ID (nanoid) |
| `name` | TEXT | Folder name (single segment) |
| `parent_id` | TEXT (FK) | Parent folder (nullable, self-ref) |
| `path` | TEXT (unique) | Denormalized full path (e.g. `/acme/logos`) |
| `created_at` | TEXT | Creation timestamp |

### `custom_tags`
Local-only tags on images (table exists; UI pending).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm deploy` | Build and deploy to Cloudflare Workers |
| `pnpm test` | Run Vitest tests |
| `pnpm lint` | Run Biome linting |
| `pnpm format` | Format code with Biome |
| `pnpm check` | Run linting and type checking |
| `pnpm db:migrate` | Apply D1 migrations locally |
| `pnpm db:generate` | Generate new Drizzle migration from schema changes |
| `pnpm db:studio` | Open Drizzle Studio for database inspection |

## Deploying to Production

1. **Set Worker secrets** on Cloudflare:

```bash
npx wrangler secret put CF_API_TOKEN
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put CF_IMAGES_HASH
```

2. **Create a D1 database** (if not already configured in `wrangler.jsonc`):

```bash
npx wrangler d1 create cloudflare-images-db
```

Then update the `wrangler.jsonc` with the new database ID.

3. **Run migrations on production D1**:

```bash
npx wrangler d1 execute cloudflare-images-db --remote --file=drizzle/0000_cf-images-init.sql
npx wrangler d1 execute cloudflare-images-db --remote --file=drizzle/0001_schema-refinements.sql
```

4. **Deploy**:

```bash
pnpm deploy
```

## Image Delivery URLs

Images are served via Cloudflare's delivery network. URLs follow this pattern:

```
https://imagedelivery.net/{CF_IMAGES_HASH}/{imageId}/{variantName}
```

The `CF_IMAGES_HASH` is your account-specific hash from the Cloudflare Images dashboard. Variant names (e.g., `public`, `thumbnail`) are managed on the Variants page.

## Key Design Decisions

- **Separation of CF vs local fields**: Image updates cleanly split Cloudflare-managed fields (metadata, signed-URLs, creator) from locally-managed fields (clientId, folderId).
- **Folder path denormalization**: Folders store both `parentId` and a full `path`. Renames/moves cascade path updates to all descendants and images using atomic D1 batches.
- **Creator-based auto-linking**: Clients can map to a Cloudflare `creator` value. Any image with that creator is automatically assigned to the client during sync and upload.
- **Server Functions as RPC**: All API/database operations are typed TanStack Start server functions with Zod validation, called from client components via React Query.

## Learn More

- [TanStack Start Documentation](https://tanstack.com/start)
- [TanStack Router Documentation](https://tanstack.com/router)
- [Cloudflare Images Documentation](https://developers.cloudflare.com/images/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
