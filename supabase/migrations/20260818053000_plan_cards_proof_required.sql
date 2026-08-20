-- Planner tasks: optional required photo proof. Staff cannot complete without proof_url.

alter table public.plan_cards
  add column if not exists proof_required boolean not null default false;

create or replace function public.guard_plan_card_assignee_self_update()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if tg_op = 'UPDATE'
     and old.staff_id = auth.uid()
     and not public.is_super_admin()
  then
    if new.card_id is distinct from old.card_id then
      raise exception using errcode = '42501', message = 'Cannot reassign planning card';
    end if;
    if new.staff_id is distinct from old.staff_id then
      raise exception using errcode = '42501', message = 'Cannot transfer planning assignment';
    end if;
    if new.status is distinct from old.status
       and not (
         (old.status = 'todo' and new.status = 'in_progress')
         or (old.status = 'in_progress' and new.status in ('for_review', 'done'))
         or (old.status = 'for_review' and new.status = 'done')
       )
    then
      raise exception using errcode = '42501', message = 'Illegal planning status transition';
    end if;
    if new.status is distinct from old.status
       and new.status in ('for_review', 'done')
       and exists (
         select 1 from public.plan_cards c
         where c.id = new.card_id and c.proof_required
       )
       and coalesce(new.proof_url, '') = ''
    then
      raise exception using errcode = '42501', message = 'Photo proof is required for this task';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_plan_card_assignee_self_update() from public, anon;
