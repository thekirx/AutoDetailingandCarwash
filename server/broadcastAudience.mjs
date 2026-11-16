/**
 * What a broadcast is allowed to target.
 *
 * The composer offers "One branch", which is narrower than "All customers" by
 * the operator's understanding and by the label on screen. The handler used to
 * express that as one compound condition:
 *
 *   if (targetAudience === 'branch' && branchSlug) { ...filter... }
 *
 * Pick "One branch", do not pick a branch, and `branch_slug` is `''`, so the
 * condition is false — as are the detailing/wash branches — and the query is
 * left unfiltered. The screen still says "One branch" and every customer in the
 * company is messaged. Nothing errors, nothing warns. With channel `sms` that
 * is the whole customer base on the meter.
 *
 * The correct behaviour was already established on the same page: the reminder
 * form refuses to save with `if (needsBranch && !draft.branch_slug)`. This is
 * that check, applied where it was missing.
 *
 * The rule is deliberately narrow: 'branch' without a branch is a refusal, not
 * a fallback to 'all'. An unrecognised audience is still 'all', exactly as
 * before — widening that would be a different decision than the one being made.
 */
export function resolveBroadcastAudience(targetAudience, branchSlug) {
  const audience = ['all', 'detailing', 'wash', 'branch'].includes(targetAudience) ? targetAudience : 'all'
  if (audience === 'branch') {
    const slug = String(branchSlug || '').trim()
    if (!slug) return { ok: false, error: 'Pick a branch before broadcasting to one branch.' }
    return { ok: true, audience, branchSlug: slug }
  }
  return { ok: true, audience, branchSlug: null }
}

export const EMPLOYEE_NOTIFY_ROLES = Object.freeze([
  'team_lead',
  'admin',
  'detailer',
  'staff',
  'assistant_super_admin',
  'sales',
  'marketing',
  'video_editor',
  'operations_lead',
  'BossMich',
])

const EMPLOYEE_BROADCAST_ROLES = new Set(['BossMich', 'assistant_super_admin'])
const VALID_EMPLOYEE_ROLES = new Set(EMPLOYEE_NOTIFY_ROLES)

/**
 * Resolve multi-audience dispatch rules (`customers` | `employees` | `both`),
 * RBAC restrictions (Marketing is customer-only), and channel constraints
 * (Employees receive In-App Inbox + Web Push only — zero BusyBee SMS).
 */
export function resolveBroadcastDispatch({
  audience_group = 'customers',
  target_audience = 'all',
  branch_slug = null,
  employee_scope = 'all',
  employee_roles = [],
  channel = 'push',
  staffRole,
} = {}) {
  const group = ['customers', 'employees', 'both'].includes(audience_group)
    ? audience_group
    : 'customers'

  if (group !== 'customers' && !EMPLOYEE_BROADCAST_ROLES.has(staffRole)) {
    return {
      ok: false,
      status: 403,
      error: 'Only Super Admin or Assistant Super Admin can target employees.',
    }
  }

  if (group === 'employees' && channel !== 'push') {
    return {
      ok: false,
      status: 400,
      error: 'Employee broadcasts use In-App Inbox and Web Push only (SMS is customer-only).',
    }
  }

  const empScope = ['all', 'roles', 'branch'].includes(employee_scope) ? employee_scope : 'all'
  const empRoles = Array.isArray(employee_roles)
    ? [...new Set(employee_roles.map((r) => String(r || '').trim()).filter((r) => VALID_EMPLOYEE_ROLES.has(r)))]
    : []

  if (group !== 'customers') {
    if (empScope === 'roles' && !empRoles.length) {
      return {
        ok: false,
        status: 400,
        error: 'Pick at least one employee role when targeting specific roles.',
      }
    }
    if (empScope === 'branch' && !String(branch_slug || '').trim()) {
      return {
        ok: false,
        status: 400,
        error: 'Pick a branch before broadcasting to one branch of employees.',
      }
    }
  }

  const customerScope = resolveBroadcastAudience(target_audience, branch_slug)
  if (group !== 'employees' && !customerScope.ok) {
    return { ok: false, status: 400, error: customerScope.error }
  }

  const cleanBranch = String(branch_slug || '').trim() || customerScope.branchSlug || null
  return {
    ok: true,
    audienceGroup: group,
    customerAudience: customerScope.audience,
    branchSlug: group === 'customers' ? customerScope.branchSlug : cleanBranch,
    employeeScope: empScope,
    employeeRoles: empRoles,
  }
}