-- Local foundation follow-up. No automatic sends or approval changes.
alter table public.friend_event_deliveries
 add column accepted_at timestamptz,
 add column delivered_at timestamptz,
 add column bounced_at timestamptz,
 add column complained_at timestamptz,
 add column provider_last_event_at timestamptz;
create unique index friend_event_provider_email_unique on public.friend_event_deliveries(provider_id) where channel='email' and provider_id is not null;
create table public.friend_event_provider_events (
 event_id text primary key check(length(event_id) between 1 and 200),
 delivery_id uuid not null references public.friend_event_deliveries(id) on delete cascade,
 event_type text not null,
 occurred_at timestamptz not null,
 recorded_at timestamptz not null default now()
);
alter table public.friend_event_provider_events enable row level security;
revoke all on public.friend_event_provider_events from anon,authenticated;
grant all on public.friend_event_provider_events to service_role;

create function public.reconcile_friend_event_email(p_delivery uuid,p_campaign text,p_provider text,p_event_id text,p_type text,p_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare d friend_event_deliveries%rowtype; next_status text; reason text; inserted integer;
begin
 if p_type not in ('email.sent','email.delivered','email.opened','email.clicked','email.delivery_delayed','email.failed','email.bounced','email.complained','email.suppressed') or p_at is null or p_at>now()+interval '1 day' or length(p_provider) not between 1 and 200 then return false; end if;
 select * into d from friend_event_deliveries where id=p_delivery and campaign_id=p_campaign and channel='email' for update;
 if not found or (d.provider_id is not null and d.provider_id<>p_provider) then return false; end if;
 insert into friend_event_provider_events(event_id,delivery_id,event_type,occurred_at) values(p_event_id,p_delivery,p_type,p_at) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return true; end if;
 next_status=case when p_type in ('email.bounced','email.complained','email.suppressed') then 'suppressed' when p_type='email.failed' then 'failed' when p_type='email.delivered' then 'delivered' when p_type='email.sent' then 'accepted' else d.status end;
 -- Terminal failures cannot be undone by a late delivered/open/click webhook.
 if d.status='suppressed' or (d.status='failed' and next_status<>'suppressed') or (d.status='delivered' and next_status in ('claimed','accepted')) then next_status=d.status; end if;
 update friend_event_deliveries set status=next_status,provider_id=p_provider,
 accepted_at=case when p_type in ('email.sent','email.delivered','email.opened','email.clicked') then coalesce(accepted_at,p_at) else accepted_at end,
 delivered_at=case when p_type='email.delivered' then coalesce(delivered_at,p_at) else delivered_at end,
 bounced_at=case when p_type='email.bounced' then coalesce(bounced_at,p_at) else bounced_at end,
 complained_at=case when p_type='email.complained' then coalesce(complained_at,p_at) else complained_at end,
 provider_last_event_at=greatest(provider_last_event_at,p_at) where id=p_delivery;
 reason=case p_type when 'email.bounced' then 'bounce' when 'email.complained' then 'complaint' when 'email.suppressed' then 'provider_suppressed' else null end;
 if reason is not null then
  insert into friend_event_suppressions(user_id,channel,reason) values(d.user_id,'email',reason)
  on conflict(user_id,channel) do update set reason=case when friend_event_suppressions.reason='complaint' then 'complaint' else excluded.reason end;
 end if;
 return true;
end $$;
revoke all on function public.reconcile_friend_event_email(uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reconcile_friend_event_email(uuid,text,text,text,text,timestamptz) to service_role;

create function public.friend_event_campaign_report(p_campaign text)
returns table(channel text,claimed bigint,provider_accepted bigint,delivered bigint,failed bigint,suppressed bigint,bounced bigint,complained bigint,raw_link_requests bigint,authenticated_returns bigint,plan_joiners bigint,plan_creators bigint,meaningful_action_users bigint)
language sql stable security definer set search_path=public as $$
 select d.channel,count(*),count(*) filter(where d.accepted_at is not null),count(*) filter(where d.delivered_at is not null),
 count(*) filter(where d.status='failed'),count(*) filter(where d.status='suppressed'),count(*) filter(where d.bounced_at is not null),count(*) filter(where d.complained_at is not null),
 count(*) filter(where a.raw_link),count(*) filter(where a.returned),count(*) filter(where a.joined),count(*) filter(where a.created),count(distinct d.user_id) filter(where a.joined or a.created)
 from friend_event_deliveries d left join lateral (
 select bool_or(event='link_request') raw_link,bool_or(event='authenticated_return') returned,bool_or(event='plan_join') joined,bool_or(event='plan_create') created
 from friend_event_attribution where delivery_id=d.id
 ) a on true
 where d.campaign_id=p_campaign group by d.channel;
$$;
revoke all on function public.friend_event_campaign_report(text) from public,anon,authenticated;
grant execute on function public.friend_event_campaign_report(text) to service_role;
