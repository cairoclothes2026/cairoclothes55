insert into public.legal_document_versions (document_id, version, document_hash) values
  ('terms', '2026-11-23-v2', '89dc020dc931de5014f9dfa7a5623eaf31c654a20349897e8a9e233021913d33'),
  ('privacy', '2026-11-23-v2', '1fba62c0b13503d5ef3fdbe16ef323499c09e6ef8fe438d27a4657306c502a04'),
  ('merchant-agreement', '2026-11-23-v2', '354b1567400170f670515129841b2b42a745545d9cfe8c51f5687ec67a3779e5'),
  ('product-policy', '2026-11-23-v2', '8e96c234f51437ae401a91e688685b669efa63faea7439394d106578da720719');
update public.legal_registration_config set version = '2026-11-23-v2' where singleton and version='2026-11-23-v1';
insert into public.consent_email_retention_versions(version) values ('2026-11-23-v2');
