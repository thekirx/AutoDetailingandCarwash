-- Ops Lab audit is SA/admin Audit page only — drop peer read policy if present.
drop policy if exists "Ops Lab peers read ops lab audits" on public.audit_logs;
