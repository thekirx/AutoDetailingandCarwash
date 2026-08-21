/** Custom role definitions (Option A): baseline template + grants overlay. */

import { ASSISTANT_GRANT_KEYS, DEFAULT_ASSISTANT_GRANTS, ROLES } from '../auth/permissions.js'

export const BASELINE_TEMPLATES = Object.freeze(Object.values(ROLES))

export function validateRoleDefinition({ roleKey, label, baselineTemplate, grants }) {
  const errors = {}
  const key = String(roleKey || '').trim().toLowerCase()
  if (!/^[a-z][a-z0-9_]{1,47}$/.test(key)) errors.role_key = 'Key must be snake_case (2–48 chars)'
  if (!String(label || '').trim()) errors.label = 'Label is required'
  if (!BASELINE_TEMPLATES.includes(baselineTemplate)) errors.baseline_template = 'Pick a system role template'
  const g = grants && typeof grants === 'object' ? grants : {}
  for (const k of Object.keys(g)) {
    if (!ASSISTANT_GRANT_KEYS.includes(k)) {
      errors.grants = `Unknown grant: ${k}`
      break
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, role_key: key, label: String(label || '').trim(), baseline_template: baselineTemplate, grants: g }
}

/** Merge custom role grants onto profile for ASA-style route checks when role is custom overlay. */
export function resolveProfileWithCustomRole(profile, roleDefinition) {
  if (!profile || !roleDefinition) return profile
  const grants = { ...DEFAULT_ASSISTANT_GRANTS, ...(roleDefinition.grants || {}) }
  return {
    ...profile,
    role: roleDefinition.baseline_template || profile.role,
    custom_role_key: roleDefinition.role_key,
    permission_grants: grants,
  }
}
