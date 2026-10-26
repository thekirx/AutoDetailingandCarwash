/** Cash-advance remaining balance. One reading for the sheet, POS, and a person's page.

Lines are daily_sheet_lines of kind ca_release (given) or ca_repay (paid back).
The current sheet is excluded from saved history and re-added from the editor,
so a line typed but not saved yet is included once.
*/

export function cashAdvanceBalances(rows = []) {
  const byStaff = new Map()
  for (const row of rows || []) {
    const staffId = row?.staff_id
    if (!staffId) continue
    const amount = Number(row.amount_minor) || 0
    if (amount <= 0) continue
    const current = byStaff.get(staffId) || {
      staffId,
      name: row.full_name || 'Staff',
      givenMinor: 0,
      repaidMinor: 0,
      movements: [],
    }
    if (row.kind === 'ca_release') current.givenMinor += amount
    else if (row.kind === 'ca_repay') current.repaidMinor += amount
    else continue
    if (row.full_name) current.name = row.full_name
    current.movements.push(row)
    byStaff.set(staffId, current)
  }
  return [...byStaff.values()]
    .map((row) => ({ ...row, remainingMinor: row.givenMinor - row.repaidMinor }))
    .sort((a, b) => b.remainingMinor - a.remainingMinor || a.name.localeCompare(b.name))
}

/** Saved rows from other sheets, plus the lines open on this sheet. */
export function cashAdvanceRowsForBalance(savedRows = [], editorLines = [], currentSheetId = null) {
  const history = (savedRows || []).filter((row) => !currentSheetId || row.sheet_id !== currentSheetId)
  const editor = (editorLines || [])
    .filter((line) => line?.staff_id && (line.kind === 'ca_release' || line.kind === 'ca_repay'))
    .map((line) => ({
      staff_id: line.staff_id,
      full_name: line.staff_name || '',
      kind: line.kind,
      amount_minor: Number(line.amount_minor) || 0,
      sheet_id: currentSheetId,
      business_date: null,
    }))
  return [...history, ...editor]
}

export function remainingForStaff(savedRows, editorLines, staffId, currentSheetId = null) {
  if (!staffId) return null
  const hit = cashAdvanceBalances(cashAdvanceRowsForBalance(savedRows, editorLines, currentSheetId))
    .find((row) => row.staffId === staffId)
  return hit || { staffId, name: '', givenMinor: 0, repaidMinor: 0, remainingMinor: 0, movements: [] }
}

export function cashAdvanceBalanceLabel(balance) {
  if (!balance || (balance.givenMinor <= 0 && balance.repaidMinor <= 0)) return 'No cash advance on record'
  if (balance.remainingMinor > 0) return 'Still owes'
  if (balance.remainingMinor < 0) return 'Paid more than was given'
  return 'Paid up'
}
