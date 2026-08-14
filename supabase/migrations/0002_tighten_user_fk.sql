-- Tightens user_id to a real FK against auth.users now that Supabase Auth is
-- wired up (see docs/supabase-storage-todo.md for why 0001 left this out).
--
-- Uses NOT VALID so any pre-existing rows (e.g. demo data inserted under the
-- fixed DEMO_USER_ID before auth existed) are grandfathered in without
-- blocking this migration — the constraint is still enforced for every new
-- insert/update from this point on. Run `validate constraint` later once
-- you've cleaned up any orphaned demo rows, if you want full validation.

alter table monitored_urls
  add constraint monitored_urls_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade
  not valid;

alter table runs
  add constraint runs_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade
  not valid;

-- Optional cleanup + full validation, once you're ready:
--   delete from monitored_urls where user_id not in (select id from auth.users);
--   alter table monitored_urls validate constraint monitored_urls_user_id_fkey;
--   alter table runs validate constraint runs_user_id_fkey;
