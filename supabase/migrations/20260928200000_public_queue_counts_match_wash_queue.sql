-- /queue/:branch counts must match the Team Lead Car Wash Queue for that branch.
-- Before: every booking line counted, including multi-day detailing (Bookings board,
-- never on the wash queue), and a multi-service visit counted once per line.
-- Now: same-day Services & Packages only, one count per visit (visit_group_id or booking),
-- grouped by branch. A visit sits in its least-advanced line's lane.

create or replace view public.public_queue_counts
with (security_invoker = false)
as
with lines as (
  select
    b.branch,
    coalesce(b.visit_group_id, b.id) as visit_key,
    case b.status
      when 'waiting' then 1
      when 'in_progress' then 2
      when 'final_checking' then 3
    end as lane_rank
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.status in ('waiting', 'in_progress', 'final_checking')
    and coalesce(b.is_archived, false) = false
    and lower(coalesce(s.pay_category, 'general')) <> 'detailing'
    and lower(coalesce(s.slug, '')) not in (
      'ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint', 'paint-protection-film'
    )
),
visits as (
  select branch, visit_key, min(lane_rank) as lane_rank
  from lines
  group by branch, visit_key
)
select
  v.branch,
  count(*) filter (where v.lane_rank = 1)::integer as waiting_count,
  count(*) filter (where v.lane_rank = 2)::integer as in_progress_count,
  count(*) filter (where v.lane_rank = 3)::integer as final_checking_count,
  count(*)::integer as total_active_count
from visits v
group by v.branch;

comment on view public.public_queue_counts is
  'Customer queue counts per branch: same-day wash/package visits only, matching the Team Lead Car Wash Queue. No PII.';

revoke all on public.public_queue_counts from public, anon, authenticated;
grant select on public.public_queue_counts to anon, authenticated;
