-- Local-only fixture: execute under service_role after applying the migration.
set role service_role;
do $$ begin
  assert (select allowed from public.consume_rate_limit('qa_rls',60,1,60));
  assert not (select allowed from public.consume_rate_limit('qa_rls',60,1,60));
  assert public.claim_stripe_event('evt_qa_rls','qa');
  assert not public.claim_stripe_event('evt_qa_rls','qa');
end $$;
reset role;
do $$ begin
  assert (select relrowsecurity from pg_class where oid='public.rate_limits'::regclass);
  assert (select relrowsecurity from pg_class where oid='public.stripe_events'::regclass);
  assert not has_table_privilege('anon','public.rate_limits','SELECT');
  assert not has_table_privilege('authenticated','public.stripe_events','INSERT');
  assert not has_function_privilege('anon','public.consume_rate_limit(text,integer,integer,integer)','EXECUTE');
end $$;
