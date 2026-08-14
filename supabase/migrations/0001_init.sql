-- ChangeScope initial schema (MASTER BUILD PROMPT §65)

create extension if not exists "pgcrypto";

-- NOTE: user_id is intentionally a plain uuid (no `references auth.users(id)`)
-- for now. Supabase Auth isn't wired up yet — the server runs behind one fixed
-- demo user id (DEMO_USER_ID) that doesn't exist as a real auth.users row, so an
-- FK here would reject every insert. RLS policies below are inert until the
-- server queries with a real user session anyway (it currently uses the
-- service_role key, which bypasses RLS). Add the FK back once auth ships:
--   alter table monitored_urls add constraint monitored_urls_user_id_fkey
--     foreign key (user_id) references auth.users(id) on delete cascade;
-- (same for runs.user_id)

create table if not exists monitored_urls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  normalized_url text not null,
  title text,
  status text not null default 'active' check (status in ('active', 'paused')),
  schedule_frequency text not null default 'every_6_hours'
    check (schedule_frequency in ('hourly', 'every_6_hours', 'daily', 'weekly')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_successful_snapshot_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_url)
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references monitored_urls(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'partial', 'failed')),
  trigger_type text not null check (trigger_type in ('manual', 'scheduled')),
  previous_snapshot_id uuid,
  current_snapshot_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  error_message text,
  meaningful_change_count int not null default 0,
  cosmetic_change_count int not null default 0,
  ai_status text not null default 'pending' check (ai_status in ('pending', 'completed', 'unavailable')),
  capture_status text not null default 'pending' check (capture_status in ('pending', 'complete', 'partial', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references monitored_urls(id) on delete cascade,
  run_id uuid not null references runs(id) on delete cascade,
  version_number int not null,
  original_url text not null,
  final_url text not null,
  title text,
  capture_status text not null check (capture_status in ('complete', 'partial', 'failed')),
  snapshot_data jsonb not null,
  content_hash text not null,
  raw_html_path text,
  screenshot_path text,
  captured_at timestamptz not null default now(),
  is_successful boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists snapshots_monitor_version_idx on snapshots (monitor_id, version_number desc);

create table if not exists changes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  group_key text not null,
  group_title text not null,
  section text,
  element_label text,
  change_type text not null check (change_type in ('added', 'removed', 'modified', 'moved', 'unchanged')),
  classification text not null check (classification in ('content', 'structural', 'functional', 'visual', 'media', 'metadata')),
  before_value text,
  after_value text,
  meaningful boolean not null default true,
  significance text not null check (significance in ('high', 'medium', 'low')),
  why_it_matters text,
  confidence numeric,
  evidence jsonb,
  created_at timestamptz not null default now()
);

create index if not exists changes_run_idx on changes (run_id);

create table if not exists agent_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  sequence int not null,
  timestamp timestamptz not null default now(),
  stage text not null,
  action text not null,
  reason text not null,
  status text not null check (status in ('in_progress', 'completed', 'failed')),
  metadata jsonb
);

create index if not exists agent_logs_run_idx on agent_logs (run_id, sequence);

-- Row Level Security: users only see their own monitors/runs.
alter table monitored_urls enable row level security;
alter table runs enable row level security;
alter table snapshots enable row level security;
alter table changes enable row level security;
alter table agent_logs enable row level security;

create policy "own monitors" on monitored_urls for all using (auth.uid() = user_id);
create policy "own runs" on runs for all using (auth.uid() = user_id);
create policy "snapshots via own monitor" on snapshots for select using (
  exists (select 1 from monitored_urls m where m.id = snapshots.monitor_id and m.user_id = auth.uid())
);
create policy "changes via own run" on changes for select using (
  exists (select 1 from runs r where r.id = changes.run_id and r.user_id = auth.uid())
);
create policy "logs via own run" on agent_logs for select using (
  exists (select 1 from runs r where r.id = agent_logs.run_id and r.user_id = auth.uid())
);
