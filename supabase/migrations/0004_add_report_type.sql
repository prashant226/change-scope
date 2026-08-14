-- Every successful run now produces an explicit report_type, computed once
-- at report-generation time from whether a previous successful snapshot
-- existed (never re-derived later from array order or timestamps).

alter table runs add column if not exists report_type text
  check (report_type in ('baseline', 'comparison'));
