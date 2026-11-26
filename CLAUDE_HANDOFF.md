# Claude continuation instructions

You are receiving the editable source repository for **Cairo Clothes**, a bilingual clothing discovery platform. Continue from this repository; do not replace it with a generic ecommerce template.

## Product rules

- Preserve the journey: **Search → Discover → Compare → Find Store → Visit → Purchase**.
- The platform helps people discover local clothing and visit the store. It is not the seller and has no online cart, payment, shipping, or platform-held inventory in this scope.
- Arabic and English are required, with correct RTL/LTR behavior.
- The first categories are Women, Men, and Kids. The initial service areas are Cairo neighborhoods in `lib/catalog.ts` and the SQL seed.
- Store offers/coupons are helpful secondary features. Keep discovery and store visits central.
- Preserve the palette: `#071B35`, `#6F1029`, `#F4EFE3`, `#D9A441`.

## Implementation expectations

1. Inspect `README.md`, `ARCHITECTURE.md`, `HANDOFF.md`, and the migration before changing the data model.
2. Keep fixtures visibly fictional until real, approved store data is supplied.
3. Implement authentication, onboarding persistence, product CRUD, admin moderation, and coupon handling behind server-side authorization. Do not claim that demo dashboards or client forms persist data.
4. Do not expose Supabase service-role credentials in client code or `.env.example`.
5. Preserve PostgreSQL portability and document any provider-specific SQL.
6. Make changes in small reviewable steps and report what remains mocked, what security work was added, and how to run the project.

## Development status

The current source includes public active-catalog reads under RLS, cookie-backed email-link authentication, pending store applications, protected admin review with audit logging/self-review blocking, and store-member product add/edit/delete through a protected route. The demo catalog remains available when Supabase credentials are absent.

The database owner should apply all migrations in order, including `0005_product_image_storage.sql`, and assign the first trusted administrator as described in `supabase/ADMIN_SETUP.md`. Allow local and production callback URLs in Supabase Auth. The seeded catalog remains fictional. Store product image upload now uses the public `product-images` bucket with owner/manager write policies; files are limited to JPG/PNG/WebP and 5 MB. Coupon redemption, inventory tracking, and production email delivery still need setup.
