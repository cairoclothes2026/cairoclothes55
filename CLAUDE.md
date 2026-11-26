# Cairo Clothes — Development Guidelines

## Project Overview

Cairo Clothes is a bilingual clothing discovery platform connecting shoppers with local stores in Cairo. Users can search, compare up to 3 products, find stores, and plan visits to physical locations.

**Core User Journey:** Search → Discover → Compare → Find Store → Visit → Purchase

**Key Design Colors:** Navy `#071B35`, Burgundy `#6F1029`, Cream `#F4EFE3`, Gold `#D9A441`

## Architecture

### Directory Structure

```
app/
  [locale]/                 # Arabic (ar) and English (en) routes
    admin/                  # Store application review (admin only)
    join-store/             # Store application form
    store-dashboard/        # Merchant product management
    stores/                 # Store directory and profiles
    products/[id]/          # Individual product pages
  globals.css               # Shared styles
components/
  Discovery.tsx            # Main discovery/comparison UI
  StoreOnboarding.tsx      # Store application form
  StoreDirectory.tsx       # Store listing
  StoreProfile.tsx         # Store profile page
  JsonLd.tsx               # Structured data
lib/
  catalog.ts               # Demo data
  catalog-client.ts        # Supabase client reads
  catalog-server.ts        # Server-side reads
  supabase.ts              # Browser client
  supabase-server.ts       # Cookie-aware server client
  site-seo.ts              # SEO utilities
```

## Tech Stack

- **Next.js 16** (App Router)
- **React 19** with Server Components
- **TypeScript** (strict mode)
- **Supabase** (PostgreSQL + Auth)
- **Tailwind CSS** for styling
- **Google Fonts**: Changa

## Development

### Prerequisites
- Node.js 20.9+
- npm

### Setup
```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

### Available Scripts
```bash
npm run dev           # Development server
npm run build         # Production build
npm run start         # Start production server
npm run lint          # ESLint
npm run typecheck     # TypeScript check
npm run dev:vinext    # Vite dev server (for vinext components)
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | For DB |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public anon key | For DB |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Server only |
| `NEXT_PUBLIC_SITE_URL` | Site origin (e.g., https://cairoclothes.com) | Production |

## Language Support

- **ar** - English (LTR) at `/en`
- **ar** - Arabic (RTL) at `/ar`
- Language toggle available in header
- Copy located in `messages/` directory

## Supabase Configuration

### Required Setup
1. Apply migrations in order from `supabase/migrations/`
2. Enable email link auth
3. Add redirect URL: `http://localhost:3000/auth/callback`

### Key Migrations
- `0001_initial_schema.sql` - Core schema
- `0002_secure_store_applications.sql` - Store app security
- `0003_admin_store_review.sql` - Admin review flows
- `0005_product_image_storage.sql` - Image uploads

### Authentication Flow
1. Email link sign-in (magic link)
2. Users can be **customer**, **store_merchant**, or **admin**
3. Store applications require admin approval

## Data Model

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles with role |
| `areas` | Cairo neighborhoods |
| `stores` | Store listings |
| `store_members` | Store ownership/membership |
| `products` | Product catalog |
| `favorites` | User saved items |
| `product_views` | Analytics |
| `offers` | Store coupons/deals |
| `redemptions` | Coupon usage |

## Security Notes

- **Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser**
- RLS policies protect all data
- Store data isolation enforced at database level
- Admin actions must go through server-side code
- Image uploads: JPG/PNG/WebP, max 5MB

## SEO & Indexing

- Pages indexable only when using real database
- Set `NEXT_PUBLIC_SITE_URL` to HTTPS origin for SEO
- Submit `/sitemap.xml` to Google Search Console
- Arabic uses `ar-EG`, English uses `en`

## Browser Support

- Modern browsers with JavaScript enabled
- Full RTL support for Arabic
- Responsive design tested down to 320px

## Common Tasks

### Adding a New Product Field
1. Update `supabase/migrations/` with new column
2. Update `lib/catalog.ts` types
3. Update UI components as needed

### Adding Translations
Edit files in `messages/` directory:
- `ar.json` - Arabic translations
- `en.json` - English translations

### Image Optimization
Images use Next.js `<Image>` from `@/components/CatalogImage`. Add domains to `next.config.ts` if using external sources.