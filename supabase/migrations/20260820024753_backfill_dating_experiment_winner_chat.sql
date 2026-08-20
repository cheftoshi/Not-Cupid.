-- Converge any winner recorded before the chat bridge shipped. The activation
-- function is idempotent and reuses an existing live Love conversation.
do $block$
declare
  v_draw record;
begin
  for v_draw in
    select d.id
    from public.raffle_draws d
    where d.status = 'both_accepted'
      and coalesce(d.a_accepted, false)
      and coalesce(d.b_accepted, false)
      and d.love_match_id is null
    order by d.created_at
  loop
    perform public.activate_dating_experiment_winner_chat(
      v_draw.id,
      pg_catalog.clock_timestamp() + interval '36 hours',
      10
    );
  end loop;
end;
$block$;
