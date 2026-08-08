-- Dating Experiment V3: award up to two disjoint mutual pairs. The existing
-- selected_pair_id/random columns remain as the first-slot compatibility view.

alter table public.dating_experiment_rounds
  add column if not exists selection_random_values numeric(12, 10)[] not null default '{}'::numeric[],
  add column if not exists selected_pair_ids uuid[] not null default '{}'::uuid[];
alter table public.dating_experiment_rounds
  add constraint dating_experiment_selected_pair_ids_capacity_check
  check (cardinality(selected_pair_ids) <= 2);

alter table public.dating_experiment_shortlist_pairs
  add column if not exists winner_slot integer
    check (winner_slot is null or winner_slot between 1 and 2);

with ranked_existing as (
  select id, row_number() over (partition by round_id order by created_at, id)::integer as slot
  from public.dating_experiment_shortlist_pairs
  where status = 'selected' and winner_slot is null
)
update public.dating_experiment_shortlist_pairs pairs
set winner_slot = ranked_existing.slot
from ranked_existing
where pairs.id = ranked_existing.id
  and ranked_existing.slot <= 2;

with selected_by_round as (
  select round_id, array_agg(id order by winner_slot)::uuid[] as pair_ids
  from public.dating_experiment_shortlist_pairs
  where status = 'selected' and winner_slot is not null
  group by round_id
)
update public.dating_experiment_rounds rounds
set selected_pair_ids = selected_by_round.pair_ids
from selected_by_round
where rounds.id = selected_by_round.round_id
  and cardinality(rounds.selected_pair_ids) = 0;

alter table public.dating_experiment_shortlist_pairs
  add constraint dating_experiment_selected_pair_slot_check
  check ((status = 'selected') = (winner_slot is not null));

create unique index if not exists dating_experiment_round_winner_slot_idx
  on public.dating_experiment_shortlist_pairs(round_id, winner_slot)
  where winner_slot is not null;

alter table public.raffle_draws
  add column if not exists winner_slot integer
    check (winner_slot is null or winner_slot between 1 and 2);

-- The V2 rules allowed at most one winner, so any historical winner is slot 1.
update public.raffle_draws
set winner_slot = 1
where event_key = 'boston-dating-experiment-v1'
  and status = 'both_accepted'
  and winner_slot is null;

drop index if exists public.raffle_draws_one_winner_per_event_idx;
create unique index if not exists raffle_draws_winner_slot_per_event_idx
  on public.raffle_draws(event_key, winner_slot)
  where status = 'both_accepted'
    and event_key = 'boston-dating-experiment-v1';

create or replace function public.enforce_dating_experiment_winner_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.event_key = 'boston-dating-experiment-v1'
    and new.status = 'both_accepted'
  then
    if new.winner_slot is null or new.winner_slot not between 1 and 2 then
      raise exception 'dating experiment winner slot must be 1 or 2';
    end if;
    if exists (
      select 1
      from public.raffle_draws existing
      where existing.event_key = new.event_key
        and existing.status = 'both_accepted'
        and existing.id <> new.id
        and (
          existing.user_a_id in (new.user_a_id, new.user_b_id)
          or existing.user_b_id in (new.user_a_id, new.user_b_id)
        )
    ) then
      raise exception 'a participant cannot win twice in one dating experiment';
    end if;
    if (
      select count(*)
      from public.raffle_draws existing
      where existing.event_key = new.event_key
        and existing.status = 'both_accepted'
        and existing.id <> new.id
    ) >= 2 then
      raise exception 'dating experiment is limited to two winning pairs';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_dating_experiment_winner_capacity()
  from public, anon, authenticated;
grant execute on function public.enforce_dating_experiment_winner_capacity()
  to service_role;

drop trigger if exists enforce_dating_experiment_winner_capacity
  on public.raffle_draws;
create trigger enforce_dating_experiment_winner_capacity
before insert or update of event_key, status, user_a_id, user_b_id, winner_slot
on public.raffle_draws
for each row execute function public.enforce_dating_experiment_winner_capacity();
