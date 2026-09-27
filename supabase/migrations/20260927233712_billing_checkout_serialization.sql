begin;
alter table public.users add column pro_checkout_key uuid;
alter table public.users add column pro_checkout_created_at timestamptz;

create function public.claim_pro_checkout(p_user uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare u public.users%rowtype;
begin
  select * into u from public.users where id=p_user for update;
  if not found or u.deleted_at is not null or u.is_blocked is true or u.is_test is true then
    raise exception 'account unavailable';
  end if;
  if u.friend_sub_id is not null or u.friend_pro_until>now() then return null; end if;
  -- Stripe session expires before its identity rotates. Reuse across tabs/retries.
  if u.pro_checkout_key is null or u.pro_checkout_created_at<now()-interval '24 hours' then
    update public.users set pro_checkout_key=gen_random_uuid(),pro_checkout_created_at=now()
    where id=p_user returning * into u;
  end if;
  return jsonb_build_object('key',u.pro_checkout_key,'expires_at',floor(extract(epoch from u.pro_checkout_created_at+interval '23 hours')));
end $$;
revoke all on function public.claim_pro_checkout(uuid) from public,anon,authenticated;
grant execute on function public.claim_pro_checkout(uuid) to service_role;

create function public.bind_pro_subscription(p_user uuid,p_subscription text,p_customer text,p_until timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare u public.users%rowtype;
begin
  select * into u from public.users where id=p_user for update;
  if not found or u.deleted_at is not null or u.is_test is true or u.is_blocked is true then return false; end if;
  if u.friend_sub_id is not null and u.friend_sub_id<>p_subscription then return false; end if;
  update public.users set friend_sub_id=p_subscription,stripe_customer_id=p_customer,
    friend_pro_until=greatest(friend_pro_until,p_until) where id=p_user;
  return true;
end $$;
revoke all on function public.bind_pro_subscription(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.bind_pro_subscription(uuid,text,text,timestamptz) to service_role;
commit;
