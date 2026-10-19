-- Planner cards can point at one ops form. Opening the card shows that form's results.

alter table public.plan_cards
  add column if not exists form_id uuid references public.ops_forms(id) on delete set null;

create index if not exists plan_cards_form_id_idx on public.plan_cards (form_id);
