-- Stamp when a cash-advance (or other ops form) is approved so daily close
-- keys off approve day, not submit day.

alter table public.ops_form_submissions
  add column if not exists resolved_at timestamptz;

create or replace function public.stamp_ops_form_resolved_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'resolved' and (tg_op = 'INSERT' or old.status is distinct from 'resolved') then
    new.resolved_at := coalesce(new.resolved_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_ops_form_resolved_at on public.ops_form_submissions;
create trigger trg_stamp_ops_form_resolved_at
before insert or update of status on public.ops_form_submissions
for each row execute function public.stamp_ops_form_resolved_at();

update public.ops_form_submissions
set resolved_at = created_at
where status = 'resolved' and resolved_at is null;

create index if not exists ops_form_submissions_resolved_at_idx
  on public.ops_form_submissions (resolved_at desc)
  where status = 'resolved' and resolved_at is not null;

revoke execute on function public.stamp_ops_form_resolved_at() from public, anon;

notify pgrst, 'reload schema';
