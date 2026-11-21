/**
 * Shared server staff authentication + branch-scope loader (service-role client).
 * Enforces `is_active = true` AND `is_archived = false` in one place across API modules.
 */
import { getBranchScopeList } from '../src/auth/permissions.js'

/**
 * Resolve an active, non-archived `staff_profiles` row without throwing on
 * missing/unauthenticated callers (returns `null` when invalid/inactive/archived).
 */
export async function resolveActiveStaff(
  admin,
  accessToken,
  {
    select = 'id, role, is_active, permission_grants, branch_slug',
    userId = null,
  } = {},
) {
  let resolvedUserId = userId
  if (!resolvedUserId) {
    if (!accessToken) return null
    const { data: userRes, error: authErr } = await admin.auth.getUser(accessToken)
    if (authErr || !userRes?.user?.id) return null
    resolvedUserId = userRes.user.id
  }

  const { data: staff, error: staffErr } = await admin
    .from('staff_profiles')
    .select(select)
    .eq('id', resolvedUserId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .maybeSingle()

  if (staffErr) {
    throw Object.assign(new Error(staffErr.message), { status: 500 })
  }
  return staff || null
}

/**
 * Verify a Supabase JWT, load the active non-archived `staff_profiles` row, run
 * an optional role/capability predicate, and hydrate assigned branch slugs.
 */
export async function requireActiveStaff(
  admin,
  accessToken,
  {
    select = 'id, role, full_name, is_active, permission_grants, branch_slug',
    unauthorizedMessage = 'Unauthorized',
    forbiddenMessage = 'Forbidden',
    authorize = null,
    hydrateBranches = true,
  } = {},
) {
  if (!accessToken) {
    throw Object.assign(new Error(unauthorizedMessage), { status: 401 })
  }
  const { data: userRes, error: authErr } = await admin.auth.getUser(accessToken)
  if (authErr || !userRes?.user) {
    throw Object.assign(new Error(unauthorizedMessage), { status: 401 })
  }

  const { data: staff, error: staffErr } = await admin
    .from('staff_profiles')
    .select(select)
    .eq('id', userRes.user.id)
    .eq('is_active', true)
    .eq('is_archived', false)
    .maybeSingle()

  if (staffErr) {
    throw Object.assign(new Error(staffErr.message), { status: 500 })
  }
  if (!staff || (typeof authorize === 'function' && !authorize(staff))) {
    throw Object.assign(new Error(forbiddenMessage), { status: 403 })
  }

  let extraBranchSlugs = []
  let branchSlugs = getBranchScopeList(staff)
  if (hydrateBranches) {
    const { data: assigns, error: assignErr } = await admin
      .from('staff_branch_assignments')
      .select('branch_slug')
      .eq('staff_id', staff.id)
    if (assignErr) {
      throw Object.assign(new Error(assignErr.message), { status: 500 })
    }
    extraBranchSlugs = (assigns || []).map((a) => a.branch_slug).filter(Boolean)
    if (Array.isArray(branchSlugs) && extraBranchSlugs.length) {
      branchSlugs = [...new Set([...branchSlugs, ...extraBranchSlugs])]
    }
  }

  return {
    ...staff,
    extraBranchSlugs,
    branchSlugs,
  }
}
