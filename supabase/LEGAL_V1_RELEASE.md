# Cairo Clothes Legal V1

The production Worker before this change is version `0fc9e6c3-5b36-4dea-a05a-1e8586cc5d70`. Its source is the reviewed release checkout at `c70f849` with the already published local visual and branding changes. The older development checkout is a different source tree. Its `0011_store_application_soft_delete.sql` does not belong to this release's migration chain.

## Apply

1. Confirm that the active Worker and the Supabase project match the reviewed release. Confirm the live schema has the required account, store, audit and Storage objects from the reviewed migrations through `0018`. The database was maintained with SQL rather than a complete migration ledger. Do not infer migration history or replay the base migrations.
2. Apply `0019_legal_registration.sql` and then `0020_self_service_account_deletion.sql`. The initial registration cutoff is unset. Neither migration backfills or removes accounts, shops or products.
3. Deploy this site build. Before enabling registration enforcement, smoke test both languages, the footer, existing sign-ins, the admin panel and the legal pages using the authorized release checks.
4. At cutover, set the cutoff once and retain its returned value with the deployment record.

```sql
update public.legal_registration_config
set effective_at = clock_timestamp()
where singleton and effective_at is null
returning effective_at;
```

Verify a test registration and audit history in an isolated environment. Keep production account data out of mutation tests. Match every stored document hash to the corresponding text in `lib/legal.ts` before changing a version.

## Roll back

Before activating the cutoff, revert the Worker to its prior version if necessary. The dormant schema can remain installed.

After activating the cutoff, prefer deploying a fix with the legal continuation screen intact. To revert the Worker in an emergency, preserve the exact cutoff and temporarily unset it before reverting so pending users can continue. The application will stop enforcing acceptance during that interval. Restore the legal application before reapplying the original cutoff, which will also cover accounts created during the interval. Keep the acceptance records and document versions. Review any partially processed merchant deletion jobs before reverting the Worker because they need the legal release's interface to resume image cleanup.

## Decisions before launch

Confirm the lawful basis, retention period, responsible operator details, and applicable privacy officer and cross-border processing obligations with Egyptian counsel. Acknowledging the privacy notice is recorded separately from accepting terms. The app has no marketing opt-in. The references in the evidence log may still be personal data after the name and email disappear. Self-service deletion supports new accounts with eligible data. Shared shops, older transferred shops and records affecting others require review through the privacy contact.
