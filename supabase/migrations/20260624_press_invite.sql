-- Press-story invite blast (6/24) — track who got the "would you share your
-- NotCupid date story?" press invite so re-running it only targets people we
-- haven't reached yet (idempotent + resumable, same pattern as the other blasts).
alter table users add column if not exists press_invite_at timestamptz;

create index if not exists users_press_invite_unsent_idx on users(id)
  where press_invite_at is null;
