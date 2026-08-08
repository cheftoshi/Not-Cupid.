-- Track which users have received the "retake the quiz" email so re-running
-- the blast only targets people we haven't reached yet.

alter table users add column if not exists quiz_blast_sent_at timestamptz;

create index if not exists users_quiz_blast_unsent_idx on users(id)
  where quiz_blast_sent_at is null;
