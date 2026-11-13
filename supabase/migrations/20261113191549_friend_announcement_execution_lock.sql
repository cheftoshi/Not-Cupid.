-- Single invocation ledger, never an approval. Not a scheduler or retry queue.
create table public.friend_announcement_executions (
 campaign_id text primary key references public.friend_event_campaigns(id),
 manifest_hash text not null,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 result jsonb
);
alter table public.friend_announcement_executions enable row level security;
revoke all on public.friend_announcement_executions from public,anon,authenticated,service_role;
grant select on public.friend_announcement_executions to service_role;
create function public.start_friend_announcement_execution(p_campaign text,p_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from friend_event_campaigns c join friend_announcement_drafts d on d.id=c.id where c.id=p_campaign and c.audience_policy='friend_line_announcement' and c.manifest_hash=p_hash and d.manifest_hash=p_hash and c.recipient_count=d.recipient_count and c.send_enabled and c.approved_at<=now() and c.content_approved_at<=now() and c.send_approved_at>c.content_approved_at and c.send_approved_at<=now() and c.expires_at>now() and d.expires_at>now() and c.provider_permission_reviewed_at<=now() and length(trim(c.provider_permission_basis))>=20) then return false; end if;
 insert into friend_announcement_executions(campaign_id,manifest_hash)values(p_campaign,p_hash)on conflict do nothing;
 return found;
end $$;
create function public.finish_friend_announcement_execution(p_campaign text,p_hash text,p_result jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 update friend_announcement_executions set finished_at=now(),result=p_result where campaign_id=p_campaign and manifest_hash=p_hash and finished_at is null;
end $$;
revoke all on function public.start_friend_announcement_execution(text,text),public.finish_friend_announcement_execution(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.start_friend_announcement_execution(text,text),public.finish_friend_announcement_execution(text,text,jsonb) to service_role;
