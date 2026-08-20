-- Repeated reconciliation must not extend a quiet chat forever. Keep the first
-- activation implementation as a service-only worker, and make the public
-- service RPC return an already-linked live match without mutating its timer.

alter function public.activate_dating_experiment_winner_chat(uuid, timestamptz, integer)
  rename to activate_dating_experiment_winner_chat_v1;

revoke all on function public.activate_dating_experiment_winner_chat_v1(uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.activate_dating_experiment_winner_chat_v1(uuid, timestamptz, integer)
  to service_role;

create function public.activate_dating_experiment_winner_chat(
  p_draw_id uuid,
  p_chat_expires_at timestamptz,
  p_max_connections integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_linked_match_id uuid;
  v_has_stale_link boolean;
begin
  select d.love_match_id into v_linked_match_id
  from public.raffle_draws d
  join public.matches m on m.id = d.love_match_id
  where d.id = p_draw_id
    and d.status = 'both_accepted'
    and coalesce(d.a_accepted, false)
    and coalesce(d.b_accepted, false)
    and m.ended_at is null
    and m.status not in ('ended', 'passed', 'expired')
    and (
      (m.user_1_id = d.user_a_id and m.user_2_id = d.user_b_id)
      or (m.user_1_id = d.user_b_id and m.user_2_id = d.user_a_id)
    );

  if v_linked_match_id is not null then
    return v_linked_match_id;
  end if;

  select exists (
    select 1
    from public.raffle_draws d
    where d.id = p_draw_id and d.love_match_id is not null
  ) into v_has_stale_link;
  if v_has_stale_link then
    raise exception 'Linked Dating Experiment chat is no longer available';
  end if;

  return public.activate_dating_experiment_winner_chat_v1(
    p_draw_id,
    p_chat_expires_at,
    p_max_connections
  );
end;
$function$;

revoke all on function public.activate_dating_experiment_winner_chat(uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.activate_dating_experiment_winner_chat(uuid, timestamptz, integer)
  to service_role;
