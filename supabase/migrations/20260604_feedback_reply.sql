-- Admin reply to user feedback. When an admin replies, we email the user and
-- stamp the reply so the admin UI shows it's been handled.
alter table feedback add column if not exists replied_at timestamptz;
alter table feedback add column if not exists reply_body text;
