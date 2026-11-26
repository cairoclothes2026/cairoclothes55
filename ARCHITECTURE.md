# Architecture

## Current structure

```text
app/
  [locale]/                 Arabic and English route group
    admin/                  protected store application review
    join-store/             merchant onboarding form
    store-dashboard/        protected merchant product management
    stores/                 directory and store profile
  globals.css               shared responsive brand styles
components/
  Discovery.tsx              customer discovery and comparison UI
  StoreOnboarding.tsx        email sign-in and merchant application form
  StoreDirectory.tsx         public store directory
  StoreProfile.tsx           public store profile
lib/
  catalog.ts                 typed demo areas, stores, and products
  catalog-client.ts          RLS-protected catalog reads and demo fallback
  supabase.ts                public browser client
  supabase-server.ts         cookie-aware client for auth and API routes
messages/                    brand and journey copy reference
supabase/
  migrations/                PostgreSQL / Supabase schema, RLS, submissions, and admin review
  seed/                      fictional development data
```

## Domain boundary

Stores own the products they list. Customers discover products, compare options, then contact or visit a physical store and purchase there. Offers are attached to a store/product as a secondary feature and are redeemed in person. There is no cart, checkout, payment processing, shipment, or platform-held stock in this starter.

## Suggested production seams

1. Replace the remaining demo catalog and dashboard metrics with reviewed store data.
2. Add coupon management to the protected merchant workspace. Product image upload is implemented with the `product-images` Supabase Storage bucket; apply migration `0005_product_image_storage.sql` to enable it.
3. Keep merchant access based on verified `store_members`; never trust client-supplied role, store owner, or approval status.
4. Extend admin moderation and coupon redemption through protected server APIs, then add integration checks for cross-store isolation.
5. Add storage, availability timestamps, consent-aware analytics, policies, and deployment operations before a real pilot.

The SQL uses Supabase Auth helpers and is intended for a Supabase PostgreSQL project. For another PostgreSQL host, replace the `auth.users` foreign key and `auth.uid()` policy helper with that host's identity mechanism.
