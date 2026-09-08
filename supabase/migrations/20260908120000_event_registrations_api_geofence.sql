-- Event registrations: close anon/authenticated direct INSERT (spam surface).
-- Public submit goes through /api/public-inquiry kind=event_registration (service role).

drop policy if exists "Anon register events" on public.event_registrations;

revoke insert on public.event_registrations from anon, authenticated;

-- Staff can still read registrations when authenticated (if a select policy exists).
-- Inserts are service-role only via the public inquiry API.
