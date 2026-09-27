set role service_role;
do $$ declare u uuid:=gen_random_uuid(); first jsonb; second jsonb; begin
  insert into public.users(id) values(u);
  first:=public.claim_pro_checkout(u);second:=public.claim_pro_checkout(u);
  assert first=second,'parallel/retried checkout identity changed';
  assert public.bind_pro_subscription(u,'sub_one','cus_one',now()+interval '31 days');
  assert public.bind_pro_subscription(u,'sub_one','cus_one',now()+interval '31 days');
  assert not public.bind_pro_subscription(u,'sub_two','cus_two',now()+interval '31 days'),'duplicate subscription overwrote original';
  assert public.claim_pro_checkout(u) is null;
  update public.users set deleted_at=now() where id=u;
  assert not public.bind_pro_subscription(u,'sub_three','cus_one',now()+interval '31 days'),'deleted account rebound';
end $$;
reset role;
