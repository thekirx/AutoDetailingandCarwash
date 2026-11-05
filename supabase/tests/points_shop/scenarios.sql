-- Run only in a throwaway local DB, after stub.sql + migration. Always rolls back scenarios.
begin;
create function pg_temp.assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %',label; end $$;
select pg_temp.assert((select pickup_code is not null and size_key='' and expires_at between now()+interval '9 days 23 hours' and now()+interval '10 days 1 hour' from accessory_redemptions where id='00000000-0000-4000-8000-000000000003'),'legacy unsized receives fresh hold/code');
select pg_temp.assert((select pickup_code is null and expires_at is null and status='fulfilled' from accessory_redemptions where id='00000000-0000-4000-8000-000000000004'),'fulfilled legacy unchanged');
do $$
declare
 c uuid := '00000000-0000-4000-8000-000000000001'; p uuid; staff uuid; result jsonb; claim uuid; code text; before_points integer;
begin
 select id into p from products where name='Hakum T-shirt';
 insert into product_branch_stock(product_id,branch_slug,size_key,qty) values(p,'bacoor','m',2),(p,'bacoor','l',3),(p,'imus','m',4);
 insert into staff_profiles(role,branch_slug) values('admin','bacoor') returning id into staff;
 result := redeem_accessory(c,p,'bacoor','M'); claim := (result->>'id')::uuid; code := result->>'pickup_code';
 perform pg_temp.assert((select qty=1 from product_branch_stock where product_id=p and branch_slug='bacoor' and size_key='m'),'selected size loses one');
 perform pg_temp.assert((select qty=3 from product_branch_stock where product_id=p and branch_slug='bacoor' and size_key='l'),'other size unchanged');
 perform pg_temp.assert((select qty=4 from product_branch_stock where product_id=p and branch_slug='imus' and size_key='m'),'other branch unchanged');
 perform pg_temp.assert((select loyalty_points=150 from customers where id=c),'points spent once');
 begin perform redeem_accessory(c,p,'bacoor','s'); raise exception 'FAIL: out of stock accepted'; exception when raise_exception then if sqlerrm not like '%out of stock%' then raise; end if; end;
 begin perform redeem_accessory(c,p,'bacoor','bad'); raise exception 'FAIL: invalid size accepted'; exception when raise_exception then if sqlerrm <> 'Choose a size.' then raise; end if; end;
 update customers set loyalty_points=0 where id=c;
 begin perform redeem_accessory(c,p,'bacoor','l'); raise exception 'FAIL: insufficient points accepted'; exception when raise_exception then if sqlerrm <> 'Not enough points.' then raise; end if; end;
 update customers set loyalty_points=150 where id=c;
 begin perform handover_redemption('bacoor','WRONG',staff); raise exception 'FAIL: wrong code accepted'; exception when raise_exception then if sqlerrm not like 'Code does not match%' then raise; end if; end;
 begin perform handover_redemption('imus',code,staff); raise exception 'FAIL: wrong branch accepted'; exception when raise_exception then if sqlerrm <> 'Use your assigned branch.' then raise; end if; end;
 perform handover_redemption('bacoor',code,staff);
 perform pg_temp.assert((select status='fulfilled' and fulfilled_by=staff and fulfilled_at is not null from accessory_redemptions where id=claim),'right code hands over');
 begin perform handover_redemption('bacoor',code,staff); raise exception 'FAIL: double handover accepted'; exception when raise_exception then if sqlerrm not like 'Code does not match%' then raise; end if; end;
 result := redeem_accessory(c,p,'bacoor','L'); claim := (result->>'id')::uuid; code := result->>'pickup_code';
 update accessory_redemptions set expires_at=now()-interval '1 second' where id=claim;
 begin perform handover_redemption('bacoor',code,staff); raise exception 'FAIL: expired handover accepted'; exception when raise_exception then if sqlerrm not like 'Code does not match%' then raise; end if; end;
 perform expire_redemptions(); perform expire_redemptions();
 perform pg_temp.assert((select loyalty_points=150 from customers where id=c),'expiry returns points exactly once');
 perform pg_temp.assert((select qty=3 from product_branch_stock where product_id=p and branch_slug='bacoor' and size_key='l'),'expiry returns chosen size exactly once');
 perform pg_temp.assert((select count(*)=1 from loyalty_ledger where customer_id=c and reason='accessory_expired'),'one refund ledger row');
 perform pg_temp.assert((select count(*)=1 from product_stock_movements where product_id=p and reason='accessory_expired' and size_key='l'),'size-aware return movement');
 perform pg_temp.assert(not has_function_privilege('authenticated','public.handover_redemption(text,text,uuid)','execute'),'authenticated cannot call handover RPC');
 perform pg_temp.assert(not has_function_privilege('authenticated','public.redeem_accessory(uuid,uuid,text,text)','execute'),'authenticated cannot claim directly');
end $$;
rollback;
