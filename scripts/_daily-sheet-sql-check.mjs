/**
 * Runs supabase/migrations/20261001090000_daily_sheet.sql on an in-memory Postgres (PGlite) with
 * minimal stubs, then exercises the RPCs + RLS. Never touches production.
 *   npm i @electric-sql/pglite --prefix "%TEMP%\hakum-pglite"
 *   PGLITE_DIR="%TEMP%\hakum-pglite" node scripts/_daily-sheet-sql-check.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const dir = process.env.PGLITE_DIR || path.join(process.env.TEMP || '/tmp', 'hakum-pglite')
const require = createRequire(path.join(dir, 'package.json'))
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href)
const migration = readFileSync(new URL('../supabase/migrations/20261001090000_daily_sheet.sql', import.meta.url), 'utf8')

const db = new PGlite()
const SA = '00000000-0000-0000-0000-0000000000aa'
const BA = '00000000-0000-0000-0000-0000000000bb'
const ASA = '00000000-0000-0000-0000-0000000000cc'
const ASA_FIN = '00000000-0000-0000-0000-0000000000cd'
const CREW = '00000000-0000-0000-0000-0000000000dd'

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  create table public.branches (slug text primary key);
  insert into public.branches values ('bacoor'), ('imus');
  create table public.staff_profiles (id uuid primary key, full_name text, role text, permission_grants jsonb default '{}', is_active boolean default true);
  create table public.staff_branches (staff_id uuid, branch text);
  insert into public.staff_profiles values
    ('${SA}', 'Boss', 'BossMich', '{}', true),
    ('${BA}', 'Bacoor BA', 'admin', '{}', true),
    ('${ASA}', 'ASA no finance', 'assistant_super_admin', '{"pos": true}', true),
    ('${ASA_FIN}', 'ASA finance', 'assistant_super_admin', '{"finance_view": true}', true),
    ('${CREW}', 'Crew One', 'staff', '{}', true);
  insert into public.staff_branches values ('${BA}', 'bacoor'), ('${ASA}', 'bacoor');
  create function public.current_user_role() returns text language sql stable security definer as $$ select role from public.staff_profiles where id = auth.uid() $$;
  create function public.is_super_admin() returns boolean language sql stable security definer as $$ select coalesce(public.current_user_role() = 'BossMich', false) $$;
  create function public.asa_has_grant(grant_key text) returns boolean language sql stable security definer as $$
    select coalesce((select role = 'assistant_super_admin' and coalesce((permission_grants->>grant_key)::boolean, false) from public.staff_profiles where id = auth.uid()), false) $$;
  create function public.user_has_branch_access(input_branch text) returns boolean language sql stable security definer as $$
    select public.is_super_admin() or exists (select 1 from public.staff_branches where staff_id = auth.uid() and branch = input_branch) $$;
  create table public.expense_categories (id uuid primary key default gen_random_uuid(), name text not null unique, is_chemical boolean not null default false,
    created_at timestamptz default now(), kind text check (kind in ('general','payroll','marketing','utilities','chemicals','equipment')), sort_order integer);
  insert into public.expense_categories (name, is_chemical) values ('General', false), ('Utilities', false), ('Payroll', false), ('Chemicals', true), ('Equipment', false), ('Marketing', false);
  create table public.expenses (id uuid primary key default gen_random_uuid(), title text not null, description text, quantity numeric default 1, unit_cost_minor integer not null,
    total_minor integer not null, branch text not null references public.branches(slug), category_id uuid references public.expense_categories(id), attachment_path text,
    status text not null default 'draft', created_by uuid, approved_by uuid, paid_by uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
    expense_kind text, vendor_id uuid);
  create table public.sales (id uuid primary key default gen_random_uuid(), branch text, status text, payment_method text, total_minor integer, discount_minor integer default 0, occurred_at timestamptz);
  create table public.audit_logs (actor_id uuid, actor_role text, action text, entity_type text, entity_id text, summary text, meta jsonb);
  create table public.payroll_runs (id uuid); create table public.payroll_run_lines (id uuid); create table public.payroll_run_sales (id uuid);
  create table public.shift_close_reports (id uuid);
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert on storage.objects to authenticated;
  create function public.run_payroll(payload jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;
  create function public.submit_shift_close(payload jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;
  create function public.review_shift_close(payload jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;
  grant execute on function public.run_payroll(jsonb) to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`)

await db.exec(migration)
await db.exec(migration) // re-runnable
console.log('✓ migration applies twice')

async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('test.uid', '${uid}', false);`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role;')
  }
}
async function fails(uid, sql, params, pattern) {
  await assert.rejects(() => as(uid, sql, params), pattern)
}
const rpc = (name) => `select public.${name}($1::jsonb) as r`

const cats = await db.query(`select code, name from public.expense_categories where code is not null order by code`)
assert.equal(cats.rows.length, 12)
assert.equal(cats.rows.find((r) => r.code === '12').name, 'Chemical and Other Inventory')
assert.equal((await db.query(`select count(*)::int n from public.expense_categories where name = 'Chemicals'`)).rows[0].n, 0)
const acct12 = (await db.query(`select id from public.expense_categories where code = '12'`)).rows[0].id
console.log('✓ 12 Xero accounts seeded, legacy categories mapped')

await db.exec(`insert into public.sales (branch, status, payment_method, total_minor, discount_minor, occurred_at) values
  ('bacoor', 'paid', 'cash', 100000, 0, '2026-10-01T03:00:00Z'),
  ('bacoor', 'paid', 'gcash', 50000, 5000, '2026-10-01T04:00:00Z'),
  ('bacoor', 'paid', 'cash', 99999, 0, '2026-09-30T03:00:00Z')`)
await db.exec(`insert into public.expenses (title, description, unit_cost_minor, total_minor, branch, status, created_at)
  values ('Detailing crew share', 'detailing:x:crew', 100, 100, 'bacoor', 'draft', '2026-10-01T05:00:00Z')`)

const base = {
  branch: 'bacoor',
  business_date: '2026-10-01',
  lines: [
    { kind: 'expense', description: 'Soap', account_id: acct12, amount_minor: 5000 },
    { kind: 'salary', staff_id: CREW, suggested_minor: 30000, amount_minor: 30000 },
    { kind: 'ca_release', staff_id: CREW, amount_minor: 10000 },
  ],
}

await fails(BA, rpc('save_daily_sheet'), [{ ...base, branch: 'imus' }], /limited to your branch/)
await fails(CREW, rpc('save_daily_sheet'), [base], /limited to your branch/)
const saved = (await as(BA, rpc('save_daily_sheet'), [base])).rows[0].r
assert.equal(saved.status, 'draft')
console.log('✓ BA saves own branch; other branch and crew are refused')

await as(SA, rpc('save_daily_sheet'), [{ branch: 'imus', business_date: '2026-10-01', lines: [] }])
const visible = await as(BA, `select branch from public.daily_sheets`)
assert.deepEqual(visible.rows.map((r) => r.branch), ['bacoor'])
const visibleLines = await as(BA, `select count(*)::int n from public.daily_sheet_lines`)
assert.equal(visibleLines.rows[0].n, 3)
await fails(BA, `insert into public.daily_sheets (branch, business_date) values ('bacoor', '2026-10-02')`, [], /permission denied/)
const asaFin = await as(ASA_FIN, `select count(*)::int n from public.daily_sheets`)
assert.equal(asaFin.rows[0].n, 2)
console.log('✓ RLS: BA sees only own branch, no direct writes; ASA finance sees all')

await fails(BA, rpc('submit_daily_sheet'), [{ id: saved.id }], /opening float/)
// float 500 + cash 1000 − soap 50 − salary 300 − CA 100 = 1050 expected
await as(BA, rpc('save_daily_sheet'), [{ ...base, opening_float_minor: 50000, counted_cash_minor: 104000 }])
await fails(BA, rpc('submit_daily_sheet'), [{ id: saved.id }], /over or short/)
await as(BA, rpc('save_daily_sheet'), [{ ...base, lines: [base.lines[0], { ...base.lines[1], amount_minor: 35000 }, base.lines[2]], opening_float_minor: 50000, counted_cash_minor: 100000 }])
await fails(BA, rpc('submit_daily_sheet'), [{ id: saved.id }], /reason/)
await as(BA, rpc('save_daily_sheet'), [{ ...base, opening_float_minor: 50000, counted_cash_minor: 105000 }])
const submitted = (await as(BA, rpc('submit_daily_sheet'), [{ id: saved.id }])).rows[0].r
assert.equal(submitted.status, 'submitted')
assert.equal(submitted.totals.expectedCashMinor, 105000)
assert.equal(submitted.totals.netMinor, 150000)
assert.equal(submitted.totals.grossMinor, 155000)
assert.equal(submitted.totals.netProfitMinor, 150000 - 5000 - 30000)
await fails(BA, rpc('save_daily_sheet'), [base], /no longer be edited/)
console.log('✓ submit re-checks float, over/short note, salary reason; locks edits')

await fails(BA, rpc('review_daily_sheet'), [{ id: saved.id, action: 'approve' }], /Only Super Admin or ASA/)
await fails(ASA, rpc('review_daily_sheet'), [{ id: saved.id, action: 'approve' }], /Only Super Admin or ASA/)
await fails(ASA_FIN, rpc('review_daily_sheet'), [{ id: saved.id, action: 'return' }], /note/)
const approved = (await as(ASA_FIN, rpc('review_daily_sheet'), [{ id: saved.id, action: 'approve' }])).rows[0].r
assert.equal(approved.posted, 2)
const again = (await as(ASA_FIN, rpc('review_daily_sheet'), [{ id: saved.id, action: 'approve' }])).rows[0].r
assert.equal(again.posted, 0)
const posted = await db.query(`select e.total_minor, e.status, e.expense_kind, c.code, (e.created_at at time zone 'Asia/Manila')::date::text d
  from public.expenses e left join public.expense_categories c on c.id = e.category_id where e.daily_sheet_line_id is not null order by e.total_minor`)
assert.deepEqual(posted.rows.map((r) => [r.total_minor, r.status, r.code, r.d]), [[5000, 'paid', '12', '2026-10-01'], [30000, 'paid', '14', '2026-10-01']])
assert.equal(posted.rows[1].expense_kind, 'salary_carwash')
assert.equal((await db.query(`select count(*)::int n from public.expenses where description like 'detailing:%'`)).rows[0].n, 0)
console.log('✓ only SA / ASA finance approve; approving twice posts once; dated on business day; CA not posted')

await fails(ASA_FIN, rpc('reopen_daily_sheet'), [{ id: saved.id, review_note: 'wrong count' }], /Only Super Admin/)
const reopened = (await as(SA, rpc('reopen_daily_sheet'), [{ id: saved.id, review_note: 'wrong count' }])).rows[0].r
assert.equal(reopened.voided, 2)
assert.equal(reopened.status, 'returned')
assert.equal((await db.query(`select count(*)::int n from public.expenses where daily_sheet_line_id is not null`)).rows[0].n, 0)
await as(BA, rpc('save_daily_sheet'), [{ ...base, opening_float_minor: 50000, counted_cash_minor: 105000 }])
console.log('✓ SA reopen voids posted rows → returned → BA can edit again')

await as(BA, `insert into storage.objects (bucket_id, name) values ('daily-sheet-receipts', 'bacoor/2026-10-01/a.jpg')`)
await fails(BA, `insert into storage.objects (bucket_id, name) values ('daily-sheet-receipts', 'imus/2026-10-01/a.jpg')`, [], /row-level security/)
console.log('✓ receipts bucket: BA uploads only under own branch')

await fails(BA, `select public.run_payroll('{}'::jsonb)`, [], /permission denied/)
console.log('✓ run_payroll revoked')

await db.exec(`insert into public.expenses (title, unit_cost_minor, total_minor, branch, status, bill_reference, due_date)
  values ('Shampoo', 1000, 1000, 'bacoor', 'draft', 'INV-77', '2026-10-31')`)
assert.equal((await db.query(`select count(*)::int n from public.expenses where bill_reference = 'INV-77' and due_date = '2026-10-31'`)).rows[0].n, 1)
await assert.rejects(db.exec(`insert into public.expenses (title, unit_cost_minor, total_minor, branch, status, bill_reference)
  values ('x', 1, 1, 'bacoor', 'draft', repeat('r', 81))`), /check constraint/)
console.log('✓ bills keep reference + due date; reference capped at 80 chars')

await fails(BA, `update public.staff_profiles set daily_rate_minor = 99900 where id = '${CREW}'`, [], /daily rate/)
await fails(BA, `insert into public.staff_profiles (id, full_name, role, daily_rate_minor) values (gen_random_uuid(), 'New TL', 'team_lead', 50000)`, [], /daily rate/)
await as(BA, `update public.staff_profiles set full_name = 'Crew Uno' where id = '${CREW}'`)
await db.exec(`update public.staff_profiles set permission_grants = '{"finance_view": true, "finance_write": true}' where id = '${ASA_FIN}'`)
await as(ASA_FIN, `update public.staff_profiles set daily_rate_minor = 60000 where id = '${CREW}'`)
await as(SA, `update public.staff_profiles set daily_rate_minor = 65000 where id = '${CREW}'`)
assert.equal((await db.query(`select daily_rate_minor from public.staff_profiles where id = '${CREW}'`)).rows[0].daily_rate_minor, 65000)
await db.exec(`update public.staff_profiles set permission_grants = '{"finance_view": true}' where id = '${ASA_FIN}'`)
console.log('✓ only SA / ASA finance write set daily rates; BA can still edit other staff fields')
console.log('ALL DAILY SHEET SQL CHECKS PASSED')
