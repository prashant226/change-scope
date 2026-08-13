-- Run once against your Supabase project (Storage buckets are not part of migrations).
-- Creates the buckets used for raw evidence (§45/§66).

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('raw-html', 'raw-html', false)
on conflict (id) do nothing;
