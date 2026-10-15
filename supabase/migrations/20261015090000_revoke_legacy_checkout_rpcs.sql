-- BUG-093: leftover checkout and Ops Lab RPCs are still callable from the browser.
--
-- complete_payment closes a car at the counter with no sales row, so the money
-- never reaches the Daily Sheet. Only the retired cashier role is branch-scoped,
-- so any Branch Admin can close any branch's car. The shop-day path is
-- complete_pos_sale; nothing in src/, server/ or api/ calls this function.
--
-- ops_lab_write_audit and resolve_ops_lab_notify_user_ids belong to the retired
-- Ops Lab and run for any signed-in user, customers included. The live audit
-- writer is write_audit_event (staff required).
--
-- This file only drops EXECUTE for public / anon / authenticated. The functions
-- stay for a later drop once no host still has them in an old bundle. service_role
-- is left alone.
--
-- Verify: scripts/probe-legacy-rpc-revoked.sql (rolled back, must report fail 0).

begin;

do $$
declare
  v_missing text;
begin
  select string_agg(req.sig, ', ') into v_missing
  from (values
    ('complete_payment(uuid,text,text,text)'),
    ('ops_lab_write_audit(text,text,text,text,jsonb)'),
    ('resolve_ops_lab_notify_user_ids(uuid)')
  ) req(sig)
  where to_regprocedure('public.' || req.sig) is null;
  if v_missing is not null then
    raise exception 'legacy RPCs missing, will not revoke a sibling by guess: %', v_missing;
  end if;
end $$;

revoke all on function public.complete_payment(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.ops_lab_write_audit(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.resolve_ops_lab_notify_user_ids(uuid) from public, anon, authenticated;

do $$
begin
  if has_function_privilege('authenticated', 'public.complete_payment(uuid,text,text,text)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.ops_lab_write_audit(text,text,text,text,jsonb)'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.resolve_ops_lab_notify_user_ids(uuid)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'public.complete_payment(uuid,text,text,text)'::regprocedure, 'execute') then
    raise exception 'BUG-093: authenticated or anon can still execute a revoked RPC';
  end if;
end $$;

commit;
