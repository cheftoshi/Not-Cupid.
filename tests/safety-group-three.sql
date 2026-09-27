begin;
set local role service_role;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  mid uuid; ctx uuid; result jsonb; kind text; n integer;
begin
  assert not has_function_privilege('anon','public.end_love_match_safely(uuid,uuid,text)','execute'),'anonymous match end RPC';
  assert not has_function_privilege('authenticated','public.report_friend_context(uuid,uuid,text,uuid,text,text)','execute'),'browser report RPC';
  insert into users(id,is_test) values(a,false),(b,false),(outsider,false);
  -- Young mutual, target replied, passed, expired: none may produce a strike.
  for n in 1..5 loop
    mid:=gen_random_uuid();
    insert into matches(id,user_1_id,user_2_id,user_1_accepted,user_2_accepted,status)
      values(mid,a,b,true,true,case n when 3 then 'passed' when 4 then 'expired' else 'both_accepted' end);
    if n<>1 then update matches set mutual_accepted_at=now()-interval '25 hours' where id=mid; end if;
    if n=2 then insert into messages(match_id,sender_id) values(mid,b); end if;
    result:=end_love_match_safely(mid,outsider,'ghosted');
    assert result is null,'non-participant could end match';
    result:=end_love_match_safely(mid,a,'ghosted');
    assert (select ghost_strikes from users where id=b)=case when n=5 then 1 else 0 end,'incorrect ghost eligibility';
    result:=end_love_match_safely(mid,a,'ghosted');
    assert (result->>'changed')::boolean=false,'repeat end changed state';
    assert (select ghost_strikes from users where id=b)=case when n=5 then 1 else 0 end,'repeat strike';
    begin
      insert into messages(match_id,sender_id) values(mid,b);
      raise exception 'closed conversation allowed a message';
    exception when raise_exception then
      if sqlerrm <> 'conversation unavailable' then raise; end if;
    end;
  end loop;
  assert (select count(*) from end_reports)=3,'terminal matches generated reports';
  assert (select matching_cooldown_until>now() from users where id=b),'cooldown missing';
  -- Test targets never get strikes, and the third lifetime strike pauses matching.
  for n in 1..3 loop
    mid:=gen_random_uuid();
    update users set is_test=(n=1) where id in (a,b);
    insert into matches(id,user_1_id,user_2_id,user_1_accepted,user_2_accepted,status,mutual_accepted_at)
      values(mid,a,b,true,true,'both_accepted',now()-interval '25 hours');
    perform end_love_match_safely(mid,a,'ghosted');
    assert (select ghost_strikes from users where id=b)=case when n=1 then 1 else n end,'test exemption or strike escalation failed';
  end loop;
  assert (select matching_disabled_at is not null from users where id=b),'third strike did not pause matching';
  -- Each channel requires real context membership and disconnects the pair.
  foreach kind in array array['dm','circle','club','plan'] loop
    delete from user_reports; delete from friend_match_history; delete from friend_connections;
    ctx:=gen_random_uuid();
    insert into friend_connections(user_a_id,user_b_id,status) values(least(a,b),greatest(a,b),'connected');
    if kind='dm' then ctx:=b;
    elsif kind='circle' then insert into friend_circle_members(circle_id,user_id) values(ctx,a),(ctx,b);
    elsif kind='club' then insert into friend_clubs values(ctx,a); insert into friend_club_members values(ctx,b,'member');
    else insert into friend_activities values(ctx,a); insert into friend_activity_rsvps values(ctx,b,'yes');
    end if;
    assert not report_friend_context(outsider,b,kind,ctx,'harassment',''),'outsider report allowed';
    assert report_friend_context(a,b,kind,ctx,'harassment','details'),'valid report rejected';
    assert report_friend_context(a,b,kind,ctx,'harassment','details'),'report retry failed';
    assert (select count(*) from user_reports)=1,'duplicate report';
    assert (select status from friend_connections limit 1)='declined','pair not disconnected';
    begin
      update friend_connections set status='connected';
      raise exception 'reported pair reconnected';
    exception when raise_exception then
      if sqlerrm <> 'friend connection unavailable' then raise; end if;
    end;
  end loop;
  delete from user_reports; delete from friend_match_history; delete from friend_connections;
  update users set is_blocked=true where id=b;
  begin
    insert into friend_connections(user_a_id,user_b_id,status) values(least(a,b),greatest(a,b),'pending');
    raise exception 'blocked user entered candidate connection';
  exception when raise_exception then
    if sqlerrm <> 'friend connection unavailable' then raise; end if;
  end;
  update users set is_blocked=false where id=b;
  insert into friend_connections(user_a_id,user_b_id,status) values(least(a,b),greatest(a,b),'declined');
  begin
    update friend_connections set status='pending';
    raise exception 'declined connection reopened';
  exception when raise_exception then
    if sqlerrm <> 'friend connection unavailable' then raise; end if;
  end;
end $$;
rollback;
