begin;

alter table public.notification_jobs drop constraint notification_jobs_status_check;
alter table public.notification_jobs add constraint notification_jobs_status_check
  check (status in ('queued','processing','delivered','retry','dead','skipped'));
alter table public.notification_jobs add column skipped_at timestamptz;

create function public.skip_notification_job(p_job_id uuid, p_reason text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.notification_jobs set status='skipped', skipped_at=now(),
    delivered_at=null, lease_expires_at=null, updated_at=now(),
    last_error_code=left(p_reason,80)
    where id=p_job_id and status='processing';
  return found;
end $$;
revoke all on function public.skip_notification_job(uuid,text) from public,anon,authenticated;
grant execute on function public.skip_notification_job(uuid,text) to service_role;

-- Preserve the earliest historical request job as the stable dedupe record.
-- Keep later records for audit, but never deliver their queued duplicates.
with ranked as (
  select j.id, r.id request_id,
    row_number() over (partition by r.id order by j.created_at,j.id) ordinal
  from public.notification_jobs j join public.connection_date_requests r
    on j.dedupe_key like 'date-request:'||r.id::text||':%'
)
update public.notification_jobs j set dedupe_key='date-request:'||r.request_id::text
from ranked r where j.id=r.id and r.ordinal=1
  and not exists(select 1 from public.notification_jobs x where x.dedupe_key='date-request:'||r.request_id::text);
update public.notification_jobs set status='skipped',skipped_at=now(),updated_at=now(),
  lease_expires_at=null,last_error_code='duplicate_date_request'
where dedupe_key like 'date-request:%:%' and status in ('queued','retry');

alter table public.connection_date_requests
  add column status_updated_at timestamptz,
  add column dismissed_at timestamptz;
-- Historical transition times are unknown; creation time is a conservative fallback.
update public.connection_date_requests set status_updated_at=created_at;
alter table public.connection_date_requests alter column status_updated_at set default now();
alter table public.connection_date_requests alter column status_updated_at set not null;

create or replace function public.date_request_transition()
returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.connection_date_plans%rowtype;
begin
  if tg_op='UPDATE' and old.status=new.status then return new; end if;
  select * into p from public.connection_date_plans where id=new.plan_id;
  if new.status='passed' and p.state='confirmed' then new.status:='filled'; end if;
  if new.status='passed' and p.state='cancelled' then new.status:='cancelled'; end if;
  new.status_updated_at:=now();
  new.dismissed_at:=null;
  if new.status='pending' then
    perform public.queue_date_notice(new.plan_id,p.host_id,new.user_id,'pending',
      'date-request:'||new.id::text);
  elsif new.status in ('accepted','passed','filled','cancelled') then
    perform public.queue_date_notice(new.plan_id,new.user_id,p.host_id,new.status,
      'date-outcome:'||new.id::text||':'||new.status);
  end if;
  return new;
end $$;

create function public.dismiss_date_outcome(p_plan uuid,p_user uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.connection_date_plans%rowtype;
begin
  select * into p from public.connection_date_plans where id=p_plan for update;
  if not found then return false; end if;
  update public.connection_date_requests set dismissed_at=coalesce(dismissed_at,now())
  where plan_id=p_plan and user_id=p_user
    and (status in ('passed','filled','cancelled') or
      (status='pending' and (p.state<>'open' or p.expires_at<=now() or p.happens_at<=now())))
    and exists(select 1 from public.users u where u.id=p_user and u.deleted_at is null
      and u.is_blocked is not true and u.age>=18 and coalesce(u.is_test,false)=p.is_test);
  return found;
end $$;
revoke all on function public.dismiss_date_outcome(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dismiss_date_outcome(uuid,uuid) to service_role;

commit;
