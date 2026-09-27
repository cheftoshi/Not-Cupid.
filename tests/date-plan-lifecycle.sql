-- Run ONLY inside a transaction that ends in ROLLBACK. All identities are synthetic test users.
set local lock_timeout='2s';
set local statement_timeout='20s';
do $test$
declare
  h uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
  c uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid();
  ra uuid; rb uuid; key uuid:=gen_random_uuid(); denied boolean; result jsonb; notices integer;
begin
  insert into public.users(id,name,age,gender,is_test,pool_active,email_notifications,zip,date_plan_genders) values
    (h,'QA lifecycle host',30,'m',true,false,false,'02116',array['f']),
    (a,'QA lifecycle guest',30,'f',true,false,false,'02116',array['m']),
    (b,'QA lifecycle other',30,'f',true,false,false,'02116',array['m']),
    (c,'QA lifecycle incompatible',30,'f',true,false,false,'02116',array['f']);
  denied:=false;
  begin
    insert into public.connection_date_plans(id,host_id,title,metro,area,mode,genders,happens_at,expires_at,is_test)
    values(p,h,'Too distant','boston','Back Bay','profile',array['f'],now()+interval '61 days',now()+interval '62 days',true);
  exception when others then denied:=true; end;
  assert denied,'distant date accepted';
  insert into public.connection_date_plans(id,host_id,title,metro,area,mode,genders,happens_at,expires_at,is_test)
    values(p,h,'QA lifecycle date','boston','Back Bay','blind',array['f'],now()+interval '60 days',now()+interval '61 days',true);
  assert (select expires_at<=now()+interval '14 days' from public.connection_date_plans where id=p),'unbounded feed expiry';
  denied:=false;
  begin perform public.connection_date_action(p,c,'request'); exception when others then denied:=true; end;
  assert denied,'non-reciprocal request accepted';
  perform public.connection_date_action(p,a,'request');
  select count(*) into notices from public.notification_jobs where entity_id=p::text;
  result:=public.connection_date_action(p,a,'request');
  assert (result->>'changed')::boolean=false,'pending retry not idempotent';
  assert (select count(*)=notices from public.notification_jobs where entity_id=p::text),'retry notified twice';
  perform public.connection_date_action(p,a,'withdraw');
  result:=public.connection_date_action(p,a,'withdraw');
  assert (result->>'changed')::boolean=false,'empty withdrawal changed';
  perform public.connection_date_action(p,a,'request');
  assert (select count(*)=1 from public.connection_date_requests where plan_id=p and user_id=a and status='pending'),'withdraw recovery failed';
  assert (select count(*)=notices+1 from public.notification_jobs where entity_id=p::text),'re-request notified twice';
  perform public.connection_date_action(p,b,'request');
  select id into ra from public.connection_date_requests where plan_id=p and user_id=a;
  select id into rb from public.connection_date_requests where plan_id=p and user_id=b;
  perform public.connection_date_action(p,h,'accept',ra);
  perform public.connection_date_action(p,h,'accept',ra);
  assert (select status='filled' from public.connection_date_requests where id=rb),'unchosen request treated as pass';
  assert (select count(*)=1 from public.notification_jobs where entity_id=p::text and recipient_id=b and payload->>'dateEvent'='filled'),'closure notice missing or duplicate';
  denied:=false; begin perform public.connection_date_action(p,h,'accept',rb); exception when others then denied:=true; end;
  assert denied,'second guest accepted';
  perform public.set_date_meeting_place(p,h,'Cambridge','QA public cafe',key);
  perform public.set_date_meeting_place(p,h,'Cambridge','QA public cafe',key);
  assert (select count(*)=1 from public.connection_date_messages where plan_id=p and kind='venue_update'),'venue audit missing or duplicate';
  assert (select count(*)=1 from public.notification_jobs where entity_id=p::text and payload->>'dateEvent'='venue_update'),'venue push missing or duplicate';
  perform public.connection_date_action(p,a,'cancel');
  denied:=false; begin perform public.set_date_meeting_place(p,h,'Back Bay','Other cafe',gen_random_uuid()); exception when others then denied:=true; end;
  assert denied,'cancelled venue editable';
  denied:=false; begin perform public.connection_date_action(p,h,'message',null,'No more messages',gen_random_uuid()); exception when others then denied:=true; end;
  assert denied,'cancelled chat writable';
  assert (select count(*)=1 from public.connection_date_messages where plan_id=p),'cancel erased archive';
  insert into public.connection_date_plans(id,host_id,title,metro,area,mode,genders,expires_at,is_test)
    values(p2,h,'QA decline','boston','Back Bay','profile',array['f'],now()+interval '1 day',true);
  perform public.connection_date_action(p2,b,'request');
  select id into rb from public.connection_date_requests where plan_id=p2 and user_id=b;
  perform public.connection_date_action(p2,h,'pass',rb);
  denied:=false; begin perform public.connection_date_action(p2,b,'request'); exception when others then denied:=true; end;
  assert denied,'host decline can be bypassed';
  assert not has_function_privilege('anon','public.set_date_meeting_place(uuid,uuid,text,text,uuid)','EXECUTE'),'anonymous venue RPC';
  assert not has_function_privilege('authenticated','public.connection_date_action(uuid,uuid,text,uuid,text,uuid)','EXECUTE'),'client date RPC';
end $test$;
