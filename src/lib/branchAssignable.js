/**
 * Branches staff may be hired into before or after opening day.
 * Coming-soon sites must accept TL / BA / crew so opening day is not blocked.
 */
export function isStaffAssignableBranch(row) {
  if (!row || row.is_archived) return false
  return row.is_active === true || row.coming_soon === true
}
