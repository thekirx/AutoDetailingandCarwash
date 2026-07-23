-- query-: role+branch fan-out for ops push (resolvePushTargets)
create index if not exists push_subscriptions_role_branch_idx
  on public.push_subscriptions (role, branch_slug)
  where role is not null;
