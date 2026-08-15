-- Separates "is automatic scheduling on?" from monitor/run status. The old
-- `status` ('active'/'paused') column is left in place (unused by the app
-- going forward) rather than dropped, to avoid a destructive migration —
-- scheduling_enabled is now the single source of truth for the scheduler.
alter table monitored_urls add column if not exists scheduling_enabled boolean not null default false;
