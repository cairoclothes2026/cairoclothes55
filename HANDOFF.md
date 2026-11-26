# Developer handoff

## Product boundary

Cairo Clothes is a clothing discovery platform. It connects shoppers to local stores and supports the physical visit and purchase. There is no cart, online payment, fulfillment, or platform-held inventory in this first web source. Coupons are a supporting feature, not the primary customer proposition.

## Ownership and modules

- `app/[locale]`: locale-routed pages and page composition.
- `components/Discovery.tsx`: interactive discovery experience.
- `lib/catalog.ts`: typed demo data and domain shapes; replace fixture reads with a repository.
- `lib/supabase.ts`: public browser client factory only.
- `supabase/migrations`: portable PostgreSQL schema and starter policies.
- `messages`: small bilingual reference strings; page copy is currently inline in components.

## Role and data boundaries

Customers read active stores/products, manage their own favorites, and submit visit intent only after a consent design is chosen. Store owners and managers can add, edit, and delete products only through verified membership and a protected server route. Store submission and admin approval/rejection are protected by database functions and role checks; admin decisions are logged, and an owner cannot review their own store. User/area/catalog management and other writes still need protected server routes. Never accept a client-supplied role, store owner, or approval state as authority. Keep admin access behind protected APIs and narrowly scoped policies rather than a public service key.

## Before external pilot

- Set up Auth, account recovery, store-member invitations, and admin MFA.
- Harden RLS; add integration tests for cross-store isolation and unauthorized status changes.
- Decide how product availability is timestamped and shown to customers.
- Add real store consent, data retention, privacy/terms, image rights, and coupon validation/redemption rules.
- Verify directions/contact information, responsive behavior, keyboard navigation, contrast, and RTL.
- Configure backups, error reporting, rate limiting, environment secrets, and rollback procedures.
- Replace all sample stores/products/photos and illustrative analytics with explicitly approved content.

## Commercial rule

The launch policy communicated in the demo is free store registration/use during launch. No recurring fees or billing logic exists. Future prices or featured placement rules require an explicit business decision and clear disclosure.
