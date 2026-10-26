/** Who still owes a cash advance. Same ledger as the Daily Sheet and My advances. */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cashAdvanceBalanceLabel, cashAdvanceBalances } from '@/lib/cashAdvanceBalance'
import { formatAccounting } from '@/lib/dailySheet'
import { loadCashAdvanceLedger, sheetErrorMessage } from '@/lib/dailySheetApi'

export default function PosCashAdvancePanel({ branch, branchLabel = '' }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    setLoading(true)
    loadCashAdvanceLedger(branch || 'all')
      .then((data) => {
        if (live) setRows(data)
      })
      .catch((err) => {
        if (live) {
          setRows([])
          toast.error(sheetErrorMessage(err))
        }
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [branch])

  const people = cashAdvanceBalances(rows)
  const owing = people.filter((row) => row.remainingMinor > 0)
  const settled = people.filter((row) => row.remainingMinor <= 0 && row.givenMinor > 0)

  return (
    <div className="flex flex-col gap-3" aria-label="Cash advance summary">
      <p className="text-sm text-muted-foreground">
        {branchLabel ? `${branchLabel}. ` : ''}
        Cash given on the Daily Sheet, minus what has been paid back. This is not an expense.
      </p>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && !owing.length ? (
        <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Nobody still owes a cash advance.</p>
      ) : null}
      {owing.length ? (
        <ul className="flex flex-col gap-2">
          {owing.map((row) => (
            <li key={row.staffId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
              <span className="font-medium">{row.name}</span>
              <span className="text-sm font-semibold tabular-nums">{formatAccounting(row.remainingMinor)} still owed</span>
            </li>
          ))}
        </ul>
      ) : null}
      {settled.length ? (
        <details className="rounded-xl border border-border px-4 py-3">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">Paid up ({settled.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {settled.map((row) => (
              <li key={row.staffId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{row.name}</span>
                <span className="text-muted-foreground">{cashAdvanceBalanceLabel(row)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
