import { useEffect, useId, useState } from 'react'
import { CheckCircle2, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { merchPhoto, normalizePickupCode, pickupDate, PICKUP_MASK } from '@/lib/pointsShop'
import { pickupAction } from '@/lib/pointsShopClient'

export function PickupHandover({ row, onHandedOver }) {
  const inputId = useId()
  const [code, setCode] = useState('')
  const [matched, setMatched] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    if (!/^HK-[A-F0-9]{8}$/.test(code)) return undefined
    let cancelled = false
    const timeout = setTimeout(async () => {
      setChecking(true)
      try {
        await pickupAction('verify', { id: row.id, branch_slug: row.branch_slug, customer_id: row.customer_id, code })
        if (!cancelled) { setMatched(code); setError('') }
      } catch (err) { if (!cancelled) { setMatched(''); setError(err.message) } }
      finally { if (!cancelled) setChecking(false) }
    }, 450)
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [code, row.id, row.branch_slug, row.customer_id])
  async function handover() {
    if (!matched || matched !== code || busy) return
    setBusy(true)
    try {
      await pickupAction('handover', { id: row.id, branch_slug: row.branch_slug, customer_id: row.customer_id, code })
      setCode(''); setMatched('')
      toast.success('Item handed over')
      onHandedOver?.()
    } catch (err) { setMatched(''); setError(err.message) }
    finally { setBusy(false) }
  }
  return <div className="space-y-3">
    <div className="flex items-center gap-3">
      <img src={merchPhoto(row.products)} alt="" className="size-12 shrink-0 rounded-lg border object-cover" />
      <div className="min-w-0"><p className="text-sm font-semibold">{row.products?.name}{row.size_key ? ` · ${row.size_key.toUpperCase()}` : ''}</p>
        <p className="text-xs text-muted-foreground">Claimed {pickupDate(row.created_at)} · Keep until {pickupDate(row.expires_at)}</p>
        <p className="font-mono text-xs text-muted-foreground">{PICKUP_MASK}</p>
      </div>
    </div>
    <div className="space-y-1.5"><Label htmlFor={inputId}>Ask the customer for their pickup code</Label>
      <div className="flex flex-col gap-2">
        <Input id={inputId} className="min-w-0 flex-1 font-mono uppercase" placeholder="HK-••••" autoComplete="off" maxLength={11}
          value={code} disabled={busy} onChange={(e) => { setCode(normalizePickupCode(e.target.value)); setMatched(''); setChecking(false); setError('') }} />

      </div>
    </div>
    {matched === code && matched ? <p className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="size-3.5" /> Code matches</p> : checking ? <p className="text-xs text-muted-foreground">Checking code…</p> : null}
    <Button className="w-full" type="button" disabled={!matched || matched !== code || busy} onClick={handover}>{busy ? 'Handing over…' : 'Hand over'}</Button>
    <p className="text-[11px] text-muted-foreground">No payment. The customer already used {row.points_spent} points. The code is only on their phone.</p>
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </div>
}

export default function PointsShopPickup({ customerId, branch }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let current = true
    if (!customerId || !branch) return undefined
    pickupAction('list', { customer_id: customerId, branch_slug: branch }).then((data) => {
      if (current) { setRows(data.redemptions || []); setError('') }
    }).catch((err) => { if (current) { setRows([]); setError(err.message) } })
    return () => { current = false }
  }, [customerId, branch, version])
  if (!customerId || !branch) return null
  const waiting = rows.filter((r) => r.customer_id === customerId && r.branch_slug === branch && r.status === 'pending' && new Date(r.expires_at) > new Date())
  if (!waiting.length && !error) return null
  return <section aria-label="Points shop pickup" className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Gift className="size-4 text-primary" />Points shop pickup</h3>
    {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : waiting.map((r) => <PickupHandover key={r.id} row={r} onHandedOver={() => setVersion((v) => v + 1)} />)}
  </section>
}
