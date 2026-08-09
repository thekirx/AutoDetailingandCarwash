# Marketing Content account provisioning

The Marketing Content account is a normal Supabase Auth user whose access is controlled by its `staff_profiles.role`. The email address identifies the login only; it must never be used to authorize portal features.

## Create the account

1. In Supabase Dashboard, open **Authentication → Users** and create or invite the dedicated Marketing Content user with the team-owned email address.
2. Copy the new Auth user UUID. Do not place the email, temporary password, service-role key, or any other secret in source control.
3. As an authorized database administrator, create or update the matching profile:

```sql
insert into public.staff_profiles (id, role)
values ('AUTH_USER_UUID', 'content_marketing')
on conflict (id) do update
set role = excluded.role;
```

If the existing project requires additional non-null profile columns, supply the normal display-name or branch values used by the current staff onboarding process. Keep `id` equal to the Supabase Auth user UUID.

## Expected access

- Sign-in redirects the account to `/operations/content`.
- The operations navigation shows **Content** only.
- The account can create, edit, publish, archive, and delete Posts and Events, and can manage files in the `content-media` bucket.
- CRM, Finance, Queue, People, Settings, bookings, and other operational areas remain unavailable.
- Existing Admin/owner-level roles retain oversight of managed content.

## Verification

After provisioning, sign in as the new user and confirm the Content workspace loads. Then directly visit a representative restricted route such as `/operations/finance`; the portal must show access denied or redirect safely.

Authorization must continue to rely on the database-backed `staff_profiles.role = 'content_marketing'`. Never add email comparisons, Auth user metadata flags, or client-only checks as substitutes for the centralized role and database policies.
