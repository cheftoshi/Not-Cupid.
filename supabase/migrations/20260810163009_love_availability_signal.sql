alter table public.users
  add column if not exists love_availability text not null default 'open_to_meeting';

alter table public.users
  drop constraint if exists users_love_availability_check;

alter table public.users
  add constraint users_love_availability_check
  check (love_availability in ('actively_looking', 'open_to_meeting'));

comment on column public.users.love_availability is
  'User-controlled Love Line intent displayed as actively looking or open to meeting; not an online-status timestamp.';
