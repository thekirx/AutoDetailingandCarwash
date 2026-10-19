-- Michi C12: staff may save their own mobile on Account settings.

begin;

create or replace function public.save_own_staff_phone(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  staff public.staff_profiles%rowtype;
  cleaned text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into staff
  from public.staff_profiles
  where id = auth.uid() and is_active = true;
  if not found then
    raise exception 'forbidden';
  end if;

  cleaned := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if cleaned = '' or char_length(cleaned) < 10 or char_length(cleaned) > 16 then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid mobile number (10–16 digits).');
  end if;

  update public.staff_profiles
  set phone = cleaned, updated_at = clock_timestamp()
  where id = staff.id;

  return jsonb_build_object('ok', true, 'phone', cleaned);
end;
$$;

revoke all on function public.save_own_staff_phone(text) from public, anon;
grant execute on function public.save_own_staff_phone(text) to authenticated;

comment on function public.save_own_staff_phone(text) is
  'Active staff update their own phone from Account settings.';

commit;
