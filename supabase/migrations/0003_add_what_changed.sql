-- Adds the fields introduced by the change-report/diff-reasoning improvement pass:
-- a grounded factual "what changed" sentence (kept separate from the
-- interpretive "why it matters"), and a needs_review flag surfaced when the
-- AI's confidence was too low to present its interpretation as settled.

alter table changes add column if not exists what_changed text;
alter table changes add column if not exists needs_review boolean not null default false;
