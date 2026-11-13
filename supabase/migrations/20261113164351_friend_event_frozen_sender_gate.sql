-- Frozen rendered messages + audience/count must be reviewed before these are set.
alter table public.friend_event_campaigns
 add column manifest_hash text check(manifest_hash ~ '^[a-f0-9]{64}$'),
 add column recipient_count integer check(recipient_count>0),
 add column content_approved_at timestamptz,
 add column send_approved_at timestamptz;
create function public.claim_frozen_friend_event_delivery(p_user uuid,p_campaign text,p_channel text,p_admin_emails text[],p_delivery uuid,p_manifest_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare claimed uuid;
begin
 if p_delivery is null or p_manifest_hash is null or not exists(select 1 from friend_event_campaigns where id=p_campaign and manifest_hash=p_manifest_hash and recipient_count>0 and content_approved_at is not null and send_approved_at>content_approved_at and send_enabled and expires_at>now()) then return null; end if;
 claimed=claim_friend_event_delivery(p_user,p_campaign,p_channel,p_admin_emails);
 if claimed is null then return null; end if;
 -- IDs are frozen before content review so personalized signed links cannot change.
 update friend_event_deliveries set id=p_delivery where id=claimed;
 return p_delivery;
end $$;
revoke all on function public.claim_frozen_friend_event_delivery(uuid,text,text,text[],uuid,text) from public,anon,authenticated;
grant execute on function public.claim_frozen_friend_event_delivery(uuid,text,text,text[],uuid,text) to service_role;
