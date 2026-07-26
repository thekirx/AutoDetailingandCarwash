-- Part 9 hardening: revoke anon EXECUTE on branch admin RPCs + hide trigger fn from API
-- Advisors: anon_security_definer_function_executable on create_branch / update_branch / trg_*

revoke all on function public.create_branch(text, text, text, text, double precision, double precision, boolean, boolean) from public, anon;
grant execute on function public.create_branch(text, text, text, text, double precision, double precision, boolean, boolean) to authenticated;

revoke all on function public.update_branch(text, text, text, text, boolean, double precision, double precision, boolean) from public, anon;
grant execute on function public.update_branch(text, text, text, text, boolean, double precision, double precision, boolean) to authenticated;

-- Trigger helper must not be callable via PostgREST
revoke all on function public.trg_products_sync_stock_group() from public, anon, authenticated;

-- Ensure Part tables stay RLS-on (idempotent)
alter table if exists public.vehicle_catalog enable row level security;
alter table if exists public.ops_forms enable row level security;
alter table if exists public.ops_form_submissions enable row level security;
alter table if exists public.plan_label_presets enable row level security;
alter table if exists public.plan_checklist_templates enable row level security;
alter table if exists public.plan_checklist_template_items enable row level security;
