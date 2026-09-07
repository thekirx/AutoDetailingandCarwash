-- run_payroll (package-kinds) inserts confirmed_by, but the column was never migrated.
alter table public.payroll_runs
  add column if not exists confirmed_by uuid;
