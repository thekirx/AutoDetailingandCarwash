-- Backfill staff_profiles.login_email from auth.users (id = auth uid).
-- Seeded demos had Auth emails but null login_email, so People/Crew UI hid the address.

update public.staff_profiles sp
set login_email = lower(u.email),
    updated_at = now()
from auth.users u
where u.id = sp.id
  and u.email is not null
  and length(trim(u.email)) > 0
  and (
    sp.login_email is null
    or length(trim(sp.login_email)) = 0
    or lower(sp.login_email) is distinct from lower(u.email)
  );
