-- Track who received the "we relaunched matching" announcement blast so
-- re-running it only targets people we haven't reached yet (idempotent +
-- resumable, same pattern as quiz_blast_sent_at).

alter table users add column if not exists relaunch_blast_sent_at timestamptz;

create index if not exists users_relaunch_blast_unsent_idx on users(id)
  where relaunch_blast_sent_at is null;
