-- Durable, service-only shadow work. No private message/profile text is stored.
create table public.embedding_shadow_jobs (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  input jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','done','skipped','failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  result_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index embedding_shadow_jobs_pending_idx on public.embedding_shadow_jobs(available_at,created_at)
  where status in ('pending','processing');
alter table public.embedding_shadow_jobs enable row level security;
revoke all on public.embedding_shadow_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.embedding_shadow_jobs to service_role;

alter table public.embedding_shadow_evaluations add column queue_job_id uuid;
create unique index embedding_shadow_evaluations_queue_job_idx on public.embedding_shadow_evaluations(queue_job_id);

create function public.claim_embedding_shadow_jobs(p_limit integer default 10)
returns setof public.embedding_shadow_jobs
language plpgsql security definer set search_path=public as $$
begin
  -- Clear terminal/abandoned payloads after a day, including while disabled.
  delete from public.embedding_shadow_jobs where created_at < now() - interval '1 day';
  update public.embedding_shadow_jobs set status='failed',finished_at=now(),result_code='lease_exhausted'
    where status='processing' and lease_until < now() and attempts >= 3;
  return query
    with candidates as (
      select id from public.embedding_shadow_jobs
      where attempts < 3 and available_at <= now()
        and (status='pending' or (status='processing' and lease_until < now()))
      order by created_at,id for update skip locked limit greatest(1,least(p_limit,10))
    )
    update public.embedding_shadow_jobs j
      set status='processing',attempts=j.attempts+1,lease_until=now()+interval '10 minutes',lease_token=gen_random_uuid()
      from candidates c where j.id=c.id returning j.*;
end;
$$;
revoke all on function public.claim_embedding_shadow_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_embedding_shadow_jobs(integer) to service_role;

-- Revoking consent/deleting an account must discard queued recommendation IDs.
create function public.clear_revoked_embedding_jobs() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.deleted_at is not null or new.is_blocked is true
    or new.ai_matching_consent_revoked_at is not null
    or new.ai_matching_consent_version is distinct from old.ai_matching_consent_version then
    delete from public.embedding_shadow_jobs where user_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.clear_revoked_embedding_jobs() from public,anon,authenticated;
create trigger clear_revoked_embedding_jobs after update of deleted_at,is_blocked,ai_matching_consent_revoked_at,ai_matching_consent_version
  on public.users for each row execute function public.clear_revoked_embedding_jobs();
