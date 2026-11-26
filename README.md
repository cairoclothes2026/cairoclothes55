# Cairo Clothes — Clothing Discovery Platform

Editable starter repository for the bilingual Cairo Clothes website. The product journey is **Search → Discover → Compare → Find Store → Visit → Purchase**. Cairo Clothes helps shoppers find clothing at local stores; it is not the seller, checkout, delivery service, or a discount-first app.

## Run locally

Prerequisites: Node.js 20.9+ and npm. From this folder:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The interface runs on fictional in-code demo data without Supabase credentials. On Windows PowerShell, copy the environment template with `Copy-Item .env.example .env.local`.

For the configured production domain, set `NEXT_PUBLIC_SITE_URL=https://cairoclothes.com` in the Cloudflare build environment and configure the public Supabase URL/key. The site keeps pages out of search while it is using demo data or a local/staging origin. Once live data and the canonical HTTPS origin are configured, public discovery, store, and product pages can be indexed; account and management routes remain excluded. Submit `/sitemap.xml` in Google Search Console after deployment.

```sh
npm run typecheck
npm run lint
npm run build
npm run start
```

## Included routes

- `/ar`, `/en` — customer discovery, area selection, search, category/price/availability filters, favorites, and comparison of up to three products.
- `/[locale]/stores` and `/[locale]/stores/[slug]` — public active-store directory and profiles, read from Supabase when configured and from fictional fixtures otherwise.
- `/[locale]/join-store` — email-link sign-in followed by a bilingual store application saved as `pending` for review.
- `/[locale]/store-dashboard` — email-link sign-in and protected product management for approved stores.
- `/[locale]/admin` — protected all-status store application management for trusted platform administrators.

Arabic uses RTL and English uses LTR. The approved palette is navy `#071B35`, burgundy `#6F1029`, cream `#F4EFE3`, and gold `#D9A441`.

## Supabase / PostgreSQL

The base model is in `supabase/migrations/0001_initial_schema.sql`, store submission is secured in `0002_secure_store_applications.sql`, trusted admin review is in `0003_admin_store_review.sql`, membership-only RLS policies are scoped to signed-in users in `0004_scope_store_membership_policies.sql`, product image storage is configured in `0005_product_image_storage.sql`, and reversible bulk store actions are in `0010_admin_bulk_store_actions.sql`. Apply migrations in order, then apply the fictional demo seed. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The public catalog reads active rows under RLS. Store applications require an email link and are saved as pending; the database derives the owner from `auth.uid()` and records consent. Admins can view every application status and approve or reject any pending request other than their own; decisions are logged. Admins can approve all eligible pending requests or hide every store from public discovery while retaining its history, with individual restore controls. Add `http://localhost:3000/auth/callback` to Supabase Auth's allowed redirect URLs before testing email links. Follow `supabase/ADMIN_SETUP.md` to grant the first admin role manually.

The schema has customer profiles, areas, stores and memberships, products, favorites, product views, store offers/coupons, and coupon redemption records. Store status and profile roles are not editable by merchant-facing database grants. Admin approvals and redemption writes are intentionally reserved for authenticated trusted server code. Review RLS and test role isolation before connecting real data.

### Production authentication email

Google and Facebook shopper registration and sign-in complete through OAuth. Shoppers using email registration choose a password. Google store registration asks for an email code; Facebook store registration completes through OAuth.

In Supabase Authentication, keep both `{{ .Token }}` and `{{ .ConfirmationURL }}` in the **Magic Link or OTP** template. The registration screen uses the code, and administrator email sign-in uses the link. Leave **Confirm sign up** available separately for email and password registrations. Configure custom SMTP for public email delivery and check the Auth logs and your email provider's delivery logs if messages do not arrive.

With Gmail SMTP, a `535 5.7.8` response on `POST /otp` means Google rejected the SMTP login. Check the SMTP username and enter the sender's current Google app password directly in Supabase SMTP Settings. See [Google's app password instructions](https://support.google.com/accounts/answer/185833).

Set the production Site URL to `https://cairoclothes.com` and check that Auth returns to `https://cairoclothes.com/auth/callback`. Google and Facebook use the separate Supabase callback shown in each provider's settings. See the [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), and [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) guides.

## Honest implementation status

The catalog can now read from Supabase, but the supplied seed is fictional. Email authentication, pending store applications, protected admin approval/rejection, membership-checked product add/edit/delete, and store-scoped product image upload are wired. Image uploads accept JPG, PNG, and WebP up to 5 MB. Apply migration `0005_product_image_storage.sql` in Supabase before using image uploads. Coupon claims/redemption, live inventory, and analytics remain unimplemented or illustrative. Review email delivery, privacy copy, rate limits, and production settings before collecting real applications.

## Portability and handoff

This is a standard Next.js App Router repository using React, TypeScript, CSS, and PostgreSQL. Supabase is an optional managed PostgreSQL/Auth adapter; the frontend is not tied to Supabase hosting. Keep credentials outside source control. `SUPABASE_SERVICE_ROLE_KEY` is intentionally absent from the browser environment template.

Read `ARCHITECTURE.md` for module boundaries and `CLAUDE_HANDOFF.md` for the requested continuation brief. `HANDOFF.md` lists security and launch work still required.

Product-level sale discounts are stored separately from the original price. Apply supabase/migrations/0006_product_discount_percent.sql before editing discounts in the merchant dashboard.
