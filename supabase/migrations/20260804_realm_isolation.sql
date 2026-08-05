-- Enforce the test/real realm boundary below the application layer.
-- Existing cross-realm Friend rows are invalid fixture leakage: retire them and
-- close any mixed crew room before installing the write guards.

update public.friend_connections as connection
set status = 'declined',
    circle_id = null,
    match_expires_at = null
from public.users as first_user, public.users as second_user
where first_user.id = connection.user_a_id
  and second_user.id = connection.user_b_id
  and coalesce(first_user.is_test, false) is distinct from coalesce(second_user.is_test, false)
  and (connection.status <> 'declined' or connection.circle_id is not null);

with mixed_circles as (
  select member.circle_id
  from public.friend_circle_members as member
  join public.users as circle_user on circle_user.id = member.user_id
  where member.left_at is null
  group by member.circle_id
  having bool_or(coalesce(circle_user.is_test, false))
     and bool_or(not coalesce(circle_user.is_test, false))
)
update public.friend_circle_members as member
set left_at = pg_catalog.clock_timestamp()
where member.left_at is null
  and member.circle_id in (select circle_id from mixed_circles);

create or replace function public.enforce_match_realm()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  realm_count integer;
  user_count integer;
begin
  select count(*), count(distinct coalesce(app_user.is_test, false))
  into user_count, realm_count
  from public.users as app_user
  where app_user.id in (new.user_1_id, new.user_2_id);

  if user_count <> 2 or realm_count <> 1 then
    raise exception 'cross-realm Love matches are not allowed' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists matches_same_realm on public.matches;
create trigger matches_same_realm
before insert or update of user_1_id, user_2_id on public.matches
for each row execute function public.enforce_match_realm();

create or replace function public.enforce_friend_connection_realm()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  realm_count integer;
  user_count integer;
begin
  select count(*), count(distinct coalesce(app_user.is_test, false))
  into user_count, realm_count
  from public.users as app_user
  where app_user.id in (new.user_a_id, new.user_b_id);

  if user_count <> 2 or realm_count <> 1 then
    raise exception 'cross-realm Friend connections are not allowed' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists friend_connections_same_realm on public.friend_connections;
create trigger friend_connections_same_realm
before insert or update of user_a_id, user_b_id on public.friend_connections
for each row execute function public.enforce_friend_connection_realm();

revoke all on function public.enforce_match_realm() from public, anon, authenticated;
revoke all on function public.enforce_friend_connection_realm() from public, anon, authenticated;
