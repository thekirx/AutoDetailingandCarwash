/**
 * Which Daily Sheets can nobody approve?
 *
 * BUG-085 refuses to let the submitter approve their own sheet. That is the
 * control working, but it creates a terminal state that did not exist before:
 * a sheet whose ONLY eligible reviewer is the person who filed it. Such a
 * sheet can never be approved, and reopen_daily_sheet accepts only 'approved'
 * sheets, so nothing can rescue it.
 *
 * Kept pure and separate from the probe so it can be tested against a
 * synthetic stranded sheet. A readiness check that prints "no stranded sheets"
 * proves nothing on its own -- an empty list is also what a broken check
 * returns, and that ambiguity is how a green all-clear gets believed.
 */

/** Sheet statuses that are waiting on somebody. Terminal states cannot strand. */
const WAITING = new Set(['submitted', 'returned'])

/**
 * @param sheets     rows of { id, status, submitted_by }
 * @param approvers  rows of { id, role, is_active, is_archived, permission_grants }
 * @returns {{ stranded: object[], waiting: object[], superAdmins: object[], financeAsas: object[] }}
 */
export function findStrandedSheets(sheets, approvers) {
  const isLive = (p) => Boolean(p.is_active) && !p.is_archived

  // Mirrors daily_sheet_can_review(): Super Admin unconditionally, otherwise an
  // ASA holding finance_view. A Branch Admin is NOT an approver and cannot
  // rescue anything -- reopen_daily_sheet is SA-only.
  const superAdmins = approvers.filter((p) => p.role === 'BossMich' && isLive(p))
  const financeAsas = approvers.filter(
    (p) => p.role === 'assistant_super_admin' && isLive(p) && (p.permission_grants?.finance_view ?? true) === true,
  )

  const waiting = sheets.filter((s) => WAITING.has(s.status))

  const stranded = waiting.filter((s) => {
    // Never filed by a person, so there is no self-approval to block.
    if (!s.submitted_by) return false
    // Someone other than the submitter can review, so the sheet can move.
    const canSa = superAdmins.some((p) => p.id !== s.submitted_by)
    const canAsa = financeAsas.some((p) => p.id !== s.submitted_by)
    return !canSa && !canAsa
  })

  return { stranded, waiting, superAdmins, financeAsas }
}