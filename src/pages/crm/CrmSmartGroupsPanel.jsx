/** CRM › Smart groups - build a customer segment from visit timeline, visit count, spend, branch and SMS reachability. */
import { useMemo, useState } from 'react'
import { Download, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/financeData'
import {
  CRM_MATCHES,
  CRM_RANGE_KINDS,
  CRM_RANGE_UNITS,
  CRM_SMART_GROUP_PRESETS,
  DEFAULT_SMART_FILTER,
  deleteSavedSmartGroup,
  describeSmartFilter,
  filterCustomersBySmartGroup,
  isSmsReachable,
  loadSavedSmartGroups,
  normalizeSmartFilter,
  saveSmartGroup,
  smartRangeError,
} from '@/lib/crmSmartGroups'
import { formatMoney } from '@/queue/queueApi'

const PAGE = 100
const SORTS = [
  { id: 'last', label: 'Last visit (newest)', cmp: (a, b) => (b.stats.lastVisit ?? -1) - (a.stats.lastVisit ?? -1) },
  { id: 'visits', label: 'Most visits', cmp: (a, b) => b.stats.visits - a.stats.visits },
  { id: 'spend', label: 'Highest spend', cmp: (a, b) => b.stats.spendMinor - a.stats.spendMinor },
  { id: 'first', label: 'First visit (newest)', cmp: (a, b) => (b.stats.firstVisit ?? -1) - (a.stats.firstVisit ?? -1) },
  { id: 'name', label: 'Name A-Z', cmp: (a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')) },
]
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** Sensible starting dates when switching to a date / month range: last 30 days, or the last 3 months. */
function defaultDates(kind) {
  const now = new Date()
  if (kind === 'between') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)), to: ymd(now) }
  if (kind === 'months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return { from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}`, to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` }
  }
  return { from: '', to: '' }
}
const fmtDay = (ms) => (ms == null ? '-' : new Date(ms).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }))
const iso = (ms) => (ms == null ? '' : new Date(ms).toISOString().slice(0, 10))
const fieldCls = 'min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm'
const csvColumns = [
  { label: 'Name', key: 'full_name' },
  { label: 'Phone', key: 'phone' },
  { label: 'Email', key: 'email' },
  { label: 'SMS opt-in', value: (r) => (r.notify_sms === false ? 'no' : 'yes') },
  { label: 'Visits', value: (r) => r.stats.visits },
  { label: 'First visit', value: (r) => iso(r.stats.firstVisit) },
  { label: 'Last visit', value: (r) => iso(r.stats.lastVisit) },
  { label: 'Spend', value: (r) => (r.stats.spendMinor / 100).toFixed(2) },
  { label: 'Customer since', value: (r) => String(r.created_at || '').slice(0, 10) },
]

function Field({ id, label, children, className }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className || ''}`}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

/**
 * @param {{ customers: object[], visits: object[], branches: { slug: string, name: string }[], userId?: string,
 *   branchName: (slug: string) => string, onView: (customer: object) => void, loading?: boolean }} props
 */
export default function CrmSmartGroupsPanel({ customers, visits, branches, userId, branchName, onView, loading }) {
  const [filter, setFilter] = useState(() => normalizeSmartFilter(CRM_SMART_GROUP_PRESETS[1]))
  const [activeId, setActiveId] = useState(CRM_SMART_GROUP_PRESETS[1].id)
  const [saved, setSaved] = useState(() => loadSavedSmartGroups(userId))
  const [groupName, setGroupName] = useState('')
  const [sort, setSort] = useState('last')
  const [shown, setShown] = useState(PAGE)

  const rangeError = filter.match === 'never' ? '' : smartRangeError(filter.range)
  const description = describeSmartFilter(filter, branchName)
  const rows = useMemo(() => {
    if (rangeError) return []
    const cmp = SORTS.find((s) => s.id === sort)?.cmp || SORTS[0].cmp
    return filterCustomersBySmartGroup(customers, visits, filter).sort(cmp)
  }, [customers, visits, filter, sort, rangeError])
  const reachable = useMemo(() => rows.filter(isSmsReachable).length, [rows])

  function apply(next, id = '') {
    setFilter(normalizeSmartFilter(next))
    setActiveId(id)
    setShown(PAGE)
  }
  /** Builder edits keep raw input (an emptied number field stays empty); filtering and saving normalize. */
  function edit(patch) {
    setFilter((cur) => ({ ...cur, ...patch }))
    setActiveId('')
    setShown(PAGE)
  }
  function editRange(patch) {
    const next = { ...filter.range, ...patch }
    if (patch.kind && patch.kind !== filter.range.kind) Object.assign(next, defaultDates(patch.kind))
    edit({ range: next })
  }
  const num = (v) => (v === '' ? null : v)

  function save() {
    const next = saveSmartGroup(userId, { name: groupName.trim() || description, filter })
    setSaved(loadSavedSmartGroups(userId))
    setActiveId(next.id)
    setGroupName('')
    toast.success(`Saved "${next.name}"`)
  }
  function remove(id) {
    setSaved(deleteSavedSmartGroup(userId, id))
    if (activeId === id) setActiveId('')
    toast.success('Group removed')
  }

  const r = filter.range
  const usesRange = filter.match !== 'never'

  return (
    <Card className="crm-groups">
      <CardHeader>
        <CardTitle>Smart groups</CardTitle>
        <CardDescription>Build a customer list for a campaign. Start from a preset or set your own dates, then save it for next time.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Start from</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Preset groups">
            {CRM_SMART_GROUP_PRESETS.map((g) => (
              <Button key={g.id} type="button" size="sm" className="min-h-11 xl:min-h-9" variant={activeId === g.id ? 'default' : 'outline'} aria-pressed={activeId === g.id} onClick={() => apply(g, g.id)}>
                {g.label}
              </Button>
            ))}
          </div>
          {saved.length ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Saved groups">
              {saved.map((g) => (
                <span key={g.id} className="inline-flex items-center">
                  <Button type="button" size="sm" className="min-h-11 rounded-r-none xl:min-h-9" variant={activeId === g.id ? 'default' : 'secondary'} aria-pressed={activeId === g.id} title={describeSmartFilter(g.filter, branchName)} onClick={() => apply(g.filter, g.id)}>
                    {g.name}
                  </Button>
                  <Button type="button" size="sm" className="min-h-11 rounded-l-none border-l border-background/40 px-2 xl:min-h-9" variant={activeId === g.id ? 'default' : 'secondary'} aria-label={`Delete saved group ${g.name}`} onClick={() => remove(g.id)}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <fieldset className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4">
          <legend className="sr-only">Custom filter</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
            <Field id="sg-match" label="Who">
              <select id="sg-match" className={fieldCls} value={filter.match} onChange={(e) => edit({ match: e.target.value })}>
                {CRM_MATCHES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            {usesRange ? (
              <Field id="sg-kind" label="When">
                <select id="sg-kind" className={fieldCls} value={r.kind} onChange={(e) => editRange({ kind: e.target.value })}>
                  {CRM_RANGE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
              </Field>
            ) : null}
            {usesRange && (r.kind === 'last' || r.kind === 'before') ? (
              <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2">
                <Field id="sg-amount" label="How many">
                  <Input id="sg-amount" type="number" inputMode="numeric" min={1} max={3650} className="min-h-11" value={r.amount} onChange={(e) => editRange({ amount: e.target.value })} />
                </Field>
                <Field id="sg-unit" label="Unit">
                  <select id="sg-unit" className={fieldCls} value={r.unit} onChange={(e) => editRange({ unit: e.target.value })}>
                    {CRM_RANGE_UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </Field>
              </div>
            ) : null}
            {usesRange && (r.kind === 'between' || r.kind === 'months') ? (
              <div className="grid grid-cols-2 gap-2">
                <Field id="sg-from" label={r.kind === 'months' ? 'From month' : 'From'}>
                  <Input id="sg-from" type={r.kind === 'months' ? 'month' : 'date'} className="min-h-11" value={r.from} max={r.to || undefined} aria-invalid={Boolean(rangeError) || undefined} onChange={(e) => editRange({ from: e.target.value })} />
                </Field>
                <Field id="sg-to" label={r.kind === 'months' ? 'To month' : 'To'}>
                  <Input id="sg-to" type={r.kind === 'months' ? 'month' : 'date'} className="min-h-11" value={r.to} min={r.from || undefined} aria-invalid={Boolean(rangeError) || undefined} onChange={(e) => editRange({ to: e.target.value })} />
                </Field>
              </div>
            ) : null}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{CRM_MATCHES.find((m) => m.id === filter.match)?.hint}</p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field id="sg-min" label="Min visits (all time)">
              <Input id="sg-min" type="number" inputMode="numeric" min={0} placeholder="Any" className="min-h-11" value={filter.minVisits ?? ''} onChange={(e) => edit({ minVisits: num(e.target.value) })} />
            </Field>
            <Field id="sg-max" label="Max visits (all time)">
              <Input id="sg-max" type="number" inputMode="numeric" min={0} placeholder="Any" className="min-h-11" value={filter.maxVisits ?? ''} onChange={(e) => edit({ maxVisits: num(e.target.value) })} />
            </Field>
            <Field id="sg-spend" label="Min spend (₱)">
              <Input id="sg-spend" type="number" inputMode="decimal" min={0} step={100} placeholder="Any" className="min-h-11" value={filter.minSpendMinor == null ? '' : filter.minSpendMinor / 100} onChange={(e) => edit({ minSpendMinor: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100) })} />
            </Field>
            {branches.length > 1 ? (
              <Field id="sg-branch" label="Visited branch">
                <select id="sg-branch" className={fieldCls} value={filter.branch} onChange={(e) => edit({ branch: e.target.value })}>
                  <option value="all">All branches</option>
                  {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                </select>
              </Field>
            ) : null}
            <label className="flex min-h-11 items-center gap-2 self-end text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={filter.smsOnly} onChange={(e) => edit({ smsOnly: e.target.checked })} />
              Only SMS-reachable
            </label>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div aria-live="polite" className="min-w-0">
            {rangeError ? (
              <p className="text-sm font-medium text-destructive" role="alert">{rangeError}</p>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums">
                  {loading ? '…' : rows.length.toLocaleString('en-PH')} <span className="text-base font-medium text-muted-foreground">customer{rows.length === 1 ? '' : 's'}</span>
                </p>
                <p className="text-sm text-muted-foreground">{description} · {reachable.toLocaleString('en-PH')} reachable by SMS</p>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="ghost" className="min-h-11 gap-1" onClick={() => apply(DEFAULT_SMART_FILTER)}>
              <RotateCcw className="size-4" aria-hidden /> Reset
            </Button>
            <Button type="button" variant="outline" className="min-h-11 gap-1" disabled={!rows.length} onClick={() => downloadCsv(rows, csvColumns, `hakum-crm-${(groupName || description).replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)}.csv`)}>
              <Download className="size-4" aria-hidden /> CSV
            </Button>
          </div>
        </div>

        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
          <Field id="sg-name" label="Save this filter as" className="min-w-[14rem] flex-1">
            <Input id="sg-name" className="min-h-11" value={groupName} maxLength={80} placeholder={description} onChange={(e) => setGroupName(e.target.value)} />
          </Field>
          <Button type="submit" className="min-h-11" disabled={Boolean(rangeError)}>Save group</Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{rows.length > shown ? `Showing ${shown} of ${rows.length}` : null}</p>
          <label className="flex items-center gap-2 text-sm text-muted-foreground" htmlFor="sg-sort">
            Sort
            <select id="sg-sort" className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead>First visit</TableHead>
              <TableHead>Last visit</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right"><span className="sr-only">Profile</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, shown).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.full_name || 'Unnamed'}</TableCell>
                <TableCell className="whitespace-nowrap">{row.phone || '-'}</TableCell>
                <TableCell className="text-right tabular-nums">{row.stats.visits}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDay(row.stats.firstVisit)}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDay(row.stats.lastVisit)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(row.stats.spendMinor)}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" size="sm" variant="outline" className="min-h-11 xl:min-h-8" aria-label={`View ${row.full_name || 'customer'}`} onClick={() => onView(row)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {loading ? 'Loading customers…' : 'No customers match. Widen the dates or remove a refinement.'}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        {rows.length > shown ? (
          <Button type="button" variant="outline" className="min-h-11 self-center" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, rows.length - shown)} more
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
