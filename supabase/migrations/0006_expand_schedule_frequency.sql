-- Monitor creation now lets the user pick the check interval up front, with a
-- richer set of options than the original four. Order matters: drop the old
-- constraint before rewriting the data (updating to a new code would violate
-- the old constraint), then tighten the constraint to the new value set.
alter table monitored_urls drop constraint if exists monitored_urls_schedule_frequency_check;

update monitored_urls set schedule_frequency = case schedule_frequency
  when 'hourly' then '1h'
  when 'every_6_hours' then '6h'
  when 'daily' then '24h'
  when 'weekly' then '24h'
  else schedule_frequency
end;

alter table monitored_urls add constraint monitored_urls_schedule_frequency_check
  check (schedule_frequency in ('30m', '1h', '2h', '6h', '12h', '24h'));

alter table monitored_urls alter column schedule_frequency set default '6h';
