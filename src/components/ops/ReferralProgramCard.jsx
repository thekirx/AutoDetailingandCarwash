import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAccessTokenFresh } from '@/lib/authToken'
import { formatDiscountPercent, normalizeReferralProgram } from '@/lib/referralProgram'

/** SA and ASA set the friend-referral points and the detailing discount. */
export default function ReferralProgramCard() {
  const [points, setPoints] = useState('50')
  const [percent, setPercent] = useState('3')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAccessTokenFresh()
        const res = await fetch('/api/referral-program', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || 'Could not load the referral program')
        if (cancelled) return
        const program = normalizeReferralProgram(body.program)
        setPoints(String(program.friend_points))
        setPercent(String(Math.round(program.discount_rate * 1000) / 10))
      } catch (err) {
        if (!cancelled) toast.error(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/referral-program', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ friend_points: points, discount_percent: percent }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not save the referral program')
      const program = normalizeReferralProgram(body.program)
      setPoints(String(program.friend_points))
      setPercent(String(Math.round(program.discount_rate * 1000) / 10))
      toast.success(`Friends earn ${program.friend_points} points. The shared code is ${formatDiscountPercent(program.discount_rate)} off detailing.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSave} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" aria-label="Referral program">
      <div>
        <h2 className="text-base font-semibold text-foreground">Friend referral</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Owner and Super Admin set both numbers. The friend&apos;s points and the detailing discount percent are whatever you save here (the starting default is 50 points and 3%). Nothing in the app locks this to 5%. Discounts already applied stay as they were.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="referral-friend-points">Points for the friend</Label>
          <Input
            id="referral-friend-points"
            type="number"
            min="0"
            max="100000"
            step="1"
            required
            value={points}
            disabled={loading || saving}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="referral-discount-percent">Detailing discount (%)</Label>
          <Input
            id="referral-discount-percent"
            type="number"
            min="0"
            max="100"
            step="0.1"
            required
            value={percent}
            disabled={loading || saving}
            onChange={(e) => setPercent(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={loading || saving}>{saving ? 'Saving' : 'Save referral program'}</Button>
      </div>
    </form>
  )
}
