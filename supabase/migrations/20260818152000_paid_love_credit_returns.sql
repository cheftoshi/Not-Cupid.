-- If a paid outgoing Love pick never becomes mutual because the recipient
-- declines or the request expires, return the same purchase as an in-app
-- extra-connection credit. A picker cannot recycle it by ending the request.

alter table public.love_pick_ledger
  drop constraint if exists love_pick_ledger_unlock_id_key;

create index if not exists love_pick_ledger_unlock_idx
  on public.love_pick_ledger (unlock_id)
  where unlock_id is not null;

create or replace function public.return_love_pick_entitlement(
  p_match_id uuid,
  p_decliner_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_ledger public.love_pick_ledger%rowtype;
begin
  select * into v_ledger from public.love_pick_ledger l
  where l.match_id = p_match_id
    and l.access_type in ('included', 'paid')
    and l.status = 'created'
  for update;
  if not found then return null; end if;

  -- Null means a system expiry. An explicit decline returns value only when it
  -- came from the recipient, never when the original picker changed course.
  if p_decliner_id is not null and p_decliner_id = v_ledger.user_id then
    return null;
  end if;

  if v_ledger.access_type = 'included' then
    update public.love_pick_ledger
      set status = 'returned', returned_at = pg_catalog.clock_timestamp()
      where id = v_ledger.id;
    return 'included';
  end if;

  if v_ledger.unlock_id is null then return null; end if;
  perform u.id from public.love_connection_unlocks u
  where u.id = v_ledger.unlock_id
    and u.user_id = v_ledger.user_id
    and u.status = 'consumed'
    and u.match_id = p_match_id
  for update;
  if not found then return null; end if;

  update public.love_connection_unlocks
    set status = 'credit', intended_candidate_id = null, match_id = null,
        consumed_at = null
    where id = v_ledger.unlock_id;
  update public.love_pick_ledger
    set status = 'returned', returned_at = pg_catalog.clock_timestamp()
    where id = v_ledger.id;
  return 'paid';
end;
$function$;

revoke all on function public.return_love_pick_entitlement(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.return_love_pick_entitlement(uuid, uuid)
  to service_role;

drop function if exists public.return_included_love_pick(uuid, uuid);
