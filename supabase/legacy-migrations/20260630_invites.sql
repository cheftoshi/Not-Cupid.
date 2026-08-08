-- Invite/referral loop: every user gets a shareable invite code (lazily
-- generated), and signups that arrive through one record who brought them.
-- The growth lever for a liquidity product: friends bring friends.
alter table users add column if not exists invite_code text unique;
alter table users add column if not exists referred_by uuid references users(id);
