import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { writeAudit } from '@/lib/audit'
import { normalizeReferralSettings } from '@/lib/referral'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

/**
 * Refer a friend controls (Super Admin). Every number the site, app and POS show
 * comes from this one row, so a client change is an edit here, not a deploy.
 * Which services count is the "Counts for refer a friend" switch on each service.
 */
export default function ReferralSettingsCard({ canEdit = false }) {
  const [state, setState] = useState({ loading: true, missing: false, form: null })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    supabase
      .from('referral_program_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live) return
        if (error || !data) {
          setState({ loading: false, missing: true, form: null })
          return
        }
        const s = normalizeReferralSettings(data)
        setState({
          loading: false,
          missing: false,
          form: {
            ...s,
            reward_value_input:
              s.reward_kind === 'percent_off' ? String(s.reward_value) : String(Number(s.reward_value || 0) / 100),
          },
        })
      })
    return () => {
      live = false
    }
  }, [])

  const form = state.form
  const set = (patch) => setState((cur) => ({ ...cur, form: { ...cur.form, ...patch } }))

  async function save(event) {
    event.preventDefault()
    if (!form) return
    const raw = Number(form.reward_value_input)
    const reward_value = form.reward_kind === 'percent_off' ? Math.round(raw) : Math.round(raw * 100)
    if (!Number.isFinite(reward_value) || reward_value < 0 || (form.reward_kind === 'percent_off' && reward_value > 100)) {
      toast.error('Check the reward value.')
      return
    }
    if (form.enabled && reward_value <= 0) {
      toast.error('Set a reward value before switching the program on.')
      return
    }
    setSaving(true)
    const patch = {
      enabled: Boolean(form.enabled),
      reward_label: String(form.reward_label || '').trim().slice(0, 80) || 'Detailing reward',
      reward_kind: form.reward_kind,
      reward_value,
      validity_days: Math.max(1, Math.min(365, Math.floor(Number(form.validity_days) || 3))),
      yearly_cap: Math.max(1, Math.min(100, Math.floor(Number(form.yearly_cap) || 5))),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('referral_program_settings').update(patch).eq('id', 1)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    await writeAudit({ action: 'update', entityType: 'referral_program_settings', entityId: '1', summary: 'Updated refer a friend', meta: patch }).catch(() => {})
    toast.success('Refer a friend saved')
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Refer a friend</CardTitle>
        <CardDescription>
          Detailing and up only, never carwash. Choose which services count with the “Counts for refer a friend” switch on
          each service.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {state.missing ? (
          <p className="text-sm text-muted-foreground">Not installed yet — the refer-a-friend database update hasn’t been applied.</p>
        ) : null}
        {form ? (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                className="size-5"
                checked={form.enabled}
                disabled={!canEdit}
                onChange={(e) => set({ enabled: e.target.checked })}
              />
              <span className="text-sm font-medium">Program on (shows /refer, links, the app card and POS rewards)</span>
            </label>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ref-label">Reward name customers see</Label>
              <Input id="ref-label" className="min-h-11" maxLength={80} disabled={!canEdit} value={form.reward_label} onChange={(e) => set({ reward_label: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Reward type</Label>
              <Select value={form.reward_kind} disabled={!canEdit} onValueChange={(reward_kind) => set({ reward_kind })}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount_off">Peso amount off one detailing service</SelectItem>
                  <SelectItem value="percent_off">Percent off one detailing service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ref-value">{form.reward_kind === 'percent_off' ? 'Percent off (1–100)' : 'Amount off (₱)'}</Label>
              <Input id="ref-value" type="number" min="0" step={form.reward_kind === 'percent_off' ? '1' : '0.01'} className="min-h-11" disabled={!canEdit} value={form.reward_value_input} onChange={(e) => set({ reward_value_input: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ref-days">Reward valid for (days)</Label>
              <Input id="ref-days" type="number" min="1" max="365" className="min-h-11" disabled={!canEdit} value={form.validity_days} onChange={(e) => set({ validity_days: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ref-cap">Friends per customer per year</Label>
              <Input id="ref-cap" type="number" min="1" max="100" className="min-h-11" disabled={!canEdit} value={form.yearly_cap} onChange={(e) => set({ yearly_cap: e.target.value })} />
            </div>
            {canEdit ? (
              <div className="sm:col-span-2">
                <Button type="submit" className="min-h-11" disabled={saving}>
                  {saving ? 'Saving…' : 'Save refer a friend'}
                </Button>
              </div>
            ) : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}
