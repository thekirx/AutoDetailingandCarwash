import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyArea, parseMigrations, scanDbUsage } from '../scripts/build-hakum-map.mjs'

test('owner map groups files and tables into business areas', () => {
  assert.equal(classifyArea('src/pages/PosPage.jsx'), 'pos')
  assert.equal(classifyArea('public_queue_counts'), 'queue')
  assert.equal(classifyArea('staff_role_overrides'), 'access')
  assert.equal(classifyArea('payroll_run_lines'), 'payroll')
  assert.equal(classifyArea('src/lib/format.js'), 'platform')
})

test('owner map parses tables, foreign keys, drops and RPC bodies from SQL', () => {
  const { objects, functions } = parseMigrations([
    { name: 'a.sql', sql: `create table public.bookings (id uuid primary key, branch_id uuid references public.branches(id), user_id uuid references auth.users(id));
      create table if not exists public.branches (id uuid primary key);
      create table public.scratch (id int);` },
    { name: 'b.sql', sql: `drop table if exists public.scratch;
      alter table public.bookings add column sale_id uuid references public.sales(id);
      create or replace function public.pay(p uuid) returns void language plpgsql as $$
      begin update public.bookings set status = 'paid'; insert into branches default values; end; $$;` },
  ])
  assert.deepEqual([...objects.keys()].sort(), ['bookings', 'branches'])
  assert.deepEqual([...objects.get('bookings').fks].sort(), ['branches', 'sales'])
  assert.equal(objects.get('bookings').definedIn, 'a.sql')
  assert.deepEqual([...functions.get('pay').touches].sort(), ['bookings', 'branches'])
})

test('owner map finds Supabase table and RPC calls in source', () => {
  const { tables, rpcs } = scanDbUsage(`supabase.from('sales').select(); Array.from(x); supabase.rpc("complete_pos_sale", {})`)
  assert.deepEqual([...tables], ['sales'])
  assert.deepEqual([...rpcs], ['complete_pos_sale'])
})
