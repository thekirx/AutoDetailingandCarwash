-- Referral scenarios: carwash never counts, refunds unqualify, cap, claim guard.
\set ON_ERROR_STOP on
-- eligibility backfill
select string_agg(slug, ',' order by slug) as not_eligible from services where not referral_eligible;
-- people
insert into customers values ('11111111-1111-1111-1111-111111111111','Kirk Orino','0917'),('22222222-2222-2222-2222-222222222222','Ana Cruz','0918'),('33333333-3333-3333-3333-333333333333','Leo','0919');
insert into staff values ('99999999-9999-9999-9999-999999999999');
update referral_program_settings set enabled = true, reward_value = 50000;
insert into customer_referrals (referrer_id, friend_id, code, created_at) values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','KIRK-7Q2', now() - interval '1 hour');
create temp table t (name text, ok boolean);
-- 1 carwash-only paid sale: stays pending
with s as (insert into sales (customer_id,status) values ('22222222-2222-2222-2222-222222222222','paid') returning id)
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select s.id, sv.id, 35000, 35000 from s, services sv where sv.slug='premium-car-wash';
insert into t select 'carwash only stays pending', status='pending' from customer_referrals;
-- 2 free award detailing line (0): still pending
with s as (insert into sales (customer_id,status) values ('22222222-2222-2222-2222-222222222222','paid') returning id)
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select s.id, sv.id, 0, 0 from s, services sv where sv.slug='interior-detailing';
insert into t select 'free detailing line does not qualify', status='pending' from customer_referrals;
-- 3 program off: no qualify
update referral_program_settings set enabled = false;
with s as (insert into sales (customer_id,status) values ('22222222-2222-2222-2222-222222222222','paid') returning id)
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select s.id, sv.id, 150000, 150000 from s, services sv where sv.slug='glass-detailing';
insert into t select 'program off does not qualify', status='pending' from customer_referrals;
update referral_program_settings set enabled = true;
-- 4 mixed carwash + interior detailing paid: qualifies, 2 rewards 3 days
create temp table q as with s as (insert into sales (customer_id,status) values ('22222222-2222-2222-2222-222222222222','paid') returning id) select id from s;
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select q.id, sv.id, 35000, 35000 from q, services sv where sv.slug='premium-car-wash';
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select q.id, sv.id, 250000, 250000 from q, services sv where sv.slug='interior-detailing';
insert into t select 'mixed sale qualifies', status='qualified' and qualifying_sale_id=(select id from q) from customer_referrals;
insert into t select 'two rewards, 3 days', count(*)=2 and bool_and(expires_at between now()+interval '71 hours' and now()+interval '73 hours') from customer_referral_rewards where status='available';
-- 5 second qualifying sale: no double grant
with s as (insert into sales (customer_id,status) values ('22222222-2222-2222-2222-222222222222','paid') returning id)
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select s.id, sv.id, 900000, 900000 from s, services sv where sv.slug='ceramic-coating';
insert into t select 'no double grant', (select count(*) from customer_referral_rewards)=2 and (select qualifying_sale_id from customer_referrals)=(select id from q);
-- 6 claim: carwash-only sale refused; eligible sale ok
update auth.cur set uid='99999999-9999-9999-9999-999999999999';
create temp table kw as with s as (insert into sales (customer_id,status) values ('11111111-1111-1111-1111-111111111111','paid') returning id) select id from s;
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select kw.id, sv.id, 35000, 35000 from kw, services sv where sv.slug='premium-car-wash';
insert into t select 'claim on carwash refused', (claim_referral_reward('11111111-1111-1111-1111-111111111111', (select id from customer_referral_rewards where role='referrer'), (select id from kw))->>'ok')::boolean = false;
create temp table kd as with s as (insert into sales (customer_id,status) values ('11111111-1111-1111-1111-111111111111','paid') returning id) select id from s;
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select kd.id, sv.id, 1300000, 1300000 from kd, services sv where sv.slug='nano-ceramic-tint';
insert into t select 'claim on tint ok', (claim_referral_reward('11111111-1111-1111-1111-111111111111', (select id from customer_referral_rewards where role='referrer'), (select id from kd))->>'ok')::boolean;
insert into t select 'claim twice refused', (claim_referral_reward('11111111-1111-1111-1111-111111111111', (select id from customer_referral_rewards where role='referrer'), (select id from kd))->>'ok')::boolean = false;
-- 7 non-staff cannot claim
update auth.cur set uid='22222222-2222-2222-2222-222222222222';
do $$ begin perform claim_referral_reward('22222222-2222-2222-2222-222222222222', (select id from customer_referral_rewards where role='friend'), null); raise exception 'should have failed'; exception when others then if sqlerrm <> 'forbidden' then raise; end if; end $$;
insert into t values ('non-staff claim forbidden', true);
-- 8 refund qualifying sale: back to pending, unclaimed friend reward void, claimed referrer kept + noted
update sales set status='refunded' where id=(select id from q);
insert into t select 'refund -> pending', status='pending' and qualifying_sale_id is null and voided_reason like '%after a reward was used' from customer_referrals;
insert into t select 'unclaimed reward voided, claimed kept', (select status from customer_referral_rewards where role='friend')='void' and (select status from customer_referral_rewards where role='referrer')='claimed';
-- 9 next paid detailing re-qualifies; voided friend reward revived, claimed referrer untouched
with s as (insert into sales (customer_id,status) values ('22222222-2222-2222-2222-222222222222','paid') returning id)
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select s.id, sv.id, 500000, 500000 from s, services sv where sv.slug='ppf-basic';
insert into t select 're-qualifies after refund', status='qualified' from customer_referrals;
insert into t select 'friend reward revived, referrer still claimed', (select status from customer_referral_rewards where role='friend')='available' and (select status from customer_referral_rewards where role='referrer')='claimed';
-- 10 yearly cap
update referral_program_settings set yearly_cap = 1;
insert into customer_referrals (referrer_id, friend_id, code, created_at) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','KIRK-7Q2', now() - interval '1 hour');
with s as (insert into sales (customer_id,status) values ('33333333-3333-3333-3333-333333333333','paid') returning id)
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select s.id, sv.id, 250000, 250000 from s, services sv where sv.slug='interior-detailing';
insert into t select 'yearly cap stops 2nd', status='pending' from customer_referrals where friend_id='33333333-3333-3333-3333-333333333333';
-- 11 self referral blocked
do $$ begin insert into customer_referrals (referrer_id, friend_id, code) values ('33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333','X'); raise exception 'should fail'; exception when check_violation then null; when unique_violation then null; end $$;
insert into t values ('self referral blocked', true);
-- 12 sale before the referral existed does not count
update referral_program_settings set yearly_cap = 5;
delete from customer_referrals where friend_id='33333333-3333-3333-3333-333333333333';
create temp table old as with s as (insert into sales (customer_id,status,occurred_at) values ('33333333-3333-3333-3333-333333333333','voided', now()-interval '2 days') returning id) select id from s;
insert into sale_line_items (sale_id, service_id, unit_price_minor, line_total_minor) select old.id, sv.id, 250000, 250000 from old, services sv where sv.slug='interior-detailing';
insert into customer_referrals (referrer_id, friend_id, code) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','KIRK-7Q2');
update sales set status='paid' where id=(select id from old);
insert into t select 'older sale does not count', status='pending' from customer_referrals where friend_id='33333333-3333-3333-3333-333333333333';
select name, ok from t order by ok, name;
select count(*) filter (where not ok) as failures from t;
