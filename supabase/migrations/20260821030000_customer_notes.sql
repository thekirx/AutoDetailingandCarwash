-- W4: durable guest notes by customer / plate (never public queue).

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  plate_normalized text,
  note_type text not null default 'general'
    check (note_type in ('general', 'like', 'dislike', 'complaint', 'preference')),
  body text not null check (char_length(trim(body)) >= 1 and char_length(body) <= 4000),
  complaint_id uuid references public.complaints(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_notes_customer_idx
  on public.customer_notes (customer_id, created_at desc)
  where archived_at is null;

create index if not exists customer_notes_plate_idx
  on public.customer_notes (plate_normalized, created_at desc)
  where archived_at is null and plate_normalized is not null;

create index if not exists customer_notes_complaint_idx
  on public.customer_notes (complaint_id)
  where complaint_id is not null;

alter table public.customer_notes enable row level security;

create policy customer_notes_select
  on public.customer_notes for select to authenticated
  using (
    public.is_staff()
    and archived_at is null
  );

create policy customer_notes_insert
  on public.customer_notes for insert to authenticated
  with check (
    public.is_super_admin()
    or public.current_user_role() in ('admin', 'team_lead', 'sales', 'BossMich')
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
  );

create policy customer_notes_update
  on public.customer_notes for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.current_user_role() in ('admin', 'team_lead', 'BossMich')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.current_user_role() in ('admin', 'team_lead', 'BossMich')
  );
