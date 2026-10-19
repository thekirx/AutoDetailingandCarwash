/** Labels and access blurbs for People. Matches docs/OPS/RBAC-MATRIX.md. */

import { normalizeAssistantGrants } from './permissions.js'

export const INTERNAL_ROLE_LABELS = Object.freeze({
  BossMich: 'Owner / Super Admin',
  assistant_super_admin: 'General Admin',
  admin: 'Branch Admin',
  operations_lead: 'Operations Lead',
  team_lead: 'Team Lead',
  staff: 'Crew',
  sales: 'Customer Rep',
  marketing: 'Marketing',
  detailer: 'Detailer',
  video_editor: 'Video Editor',
  investor: 'Investor',
})

/** One line shown under the role picker so the assignment matches the sheet. */
export const ROLE_ACCESS_SUMMARY = Object.freeze({
  BossMich: 'All branches. Full access, including the Floor Board.',
  assistant_super_admin: 'All branches. Full access except the Floor Board. Finance write and Planning edit start on so this matches the sheet.',
  admin: 'Assigned branch. Queue and detailing are read-only. POS, finance, attendance, and customer create/modify are on. No Cash advance planner board.',
  team_lead: 'Assigned branch. Full queue and detailing. Attendance is read-only. Customers are read-only. No POS, vouchers, or finance. No Cash advance planner board.',
  staff: 'Assigned branch. Clock, My Tasks, Floor Board watch, and Planner Forms. Not on the 19 Oct named-account sheet.',
  sales: 'All branches. Queue and detailing are read-only. Customers can be created and modified. No Floor Board, POS, vouchers, finance, or attendance.',
  marketing: 'All branches. Queue, detailing, and customers are read-only. No Floor Board, POS, vouchers, finance, or attendance.',
  detailer: 'Assigned branch. Detailing board and attendance. Not on the 19 Oct named-account sheet.',
  video_editor: 'Assigned branch. Planner calendar and My Tasks. Not on the 19 Oct named-account sheet.',
  investor: 'Assigned branch only. Read-only queue, detailing, POS, vouchers, and finance. No Floor Board, planner, attendance, or customers.',
  operations_lead: 'All branches. Network ops. Not a row on the 19 Oct sheet.',
})

export function internalRoleLabel(role) {
  return INTERNAL_ROLE_LABELS[role] || role || 'Ops'
}

export function roleAccessSummary(role) {
  return ROLE_ACCESS_SUMMARY[role] || ''
}

/** Explicit grants saved when People creates a General Admin. Absent keys stay denied in SQL. */
export function generalAdminSheetGrants() {
  return normalizeAssistantGrants({ finance_write: true, planning_edit: true })
}
