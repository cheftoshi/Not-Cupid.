-- Test accounts: flag throwaway users so the magic dev-login can ONLY ever
-- create a session for a test account, never a real user (the hard safety gate).
alter table users add column if not exists is_test boolean not null default false;
create index if not exists users_is_test_idx on users(is_test) where is_test = true;
