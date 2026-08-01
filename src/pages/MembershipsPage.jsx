import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Crown, Gift, Pencil, Plus, Settings2, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessMemberships, isSuperAdmin } from '@/auth/permissions'
import {
  assignCustomerMembership,
  createLoyaltyMilestone,
  createMembershipTier,
  getLoyaltyProgramSettings,
  listActiveCustomerMemberships,
  listCustomersForMembership,
  listLoyaltyMilestones,
  listMembershipTiers,
  listServices,
  revokeCustomerMembership,
  updateLoyaltyMilestone,
  updateLoyaltyProgramSettings,
  updateMembershipTier,
  updateServiceLoyaltyWeight,
} from '@/lib/adminApi'
import { LOYALTY_PAY_CATEGORIES } from '@/lib/loyaltyLogic'
import { formatMoney } from '@/queue/queueApi'
import { formatSizePriceRange } from '@/lib/servicePricing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const emptyTier = {
  name: '',
  starting_price: '',
  discount_percent: '0',
  loyalty_multiplier: '1',
  benefits: '',
  included_services: '',
}

const emptyMilestone = {
  threshold_points: '',
  reward_label: '',
  reward_description: '',
  sort_order: '0',
}

const emptyProgramForm = {
  card_slots: '15',
  stamps_enabled: true,
  points_enabled: true,
  memberships_enabled: true,
  stamp_earn_mode: 'all_weighted',
  stamp_pay_categories: ['wash'],
  apply_membership_multiplier_to_stamps: false,
  wrap_stamps_at_card: false,
}

function settingsToProgramForm(row) {
  return {
    card_slots: String(row?.card_slots || 15),
    stamps_enabled: row?.stamps_enabled !== false,
    points_enabled: row?.points_enabled !== false,
    memberships_enabled: row?.memberships_enabled !== false,
    stamp_earn_mode: row?.stamp_earn_mode || 'all_weighted',
    stamp_pay_categories: Array.isArray(row?.stamp_pay_categories) && row.stamp_pay_categories.length
      ? [...row.stamp_pay_categories]
      : ['wash'],
    apply_membership_multiplier_to_stamps: !!row?.apply_membership_multiplier_to_stamps,
    wrap_stamps_at_card: !!row?.wrap_stamps_at_card,
  }
}

export default function MembershipsPage() {
  const { profile } = useAuth()
  const superAdmin = isSuperAdmin(profile)
  const [tiers, setTiers] = useState([])
  const [milestones, setMilestones] = useState([])
  const [services, setServices] = useState([])
  const [customers, setCustomers] = useState([])
  const [activeMemberships, setActiveMemberships] = useState([])
  const [settings, setSettings] = useState({ card_slots: 15 })
  const [programForm, setProgramForm] = useState(emptyProgramForm)
  const [tierForm, setTierForm] = useState(emptyTier)
  const [milestoneForm, setMilestoneForm] = useState(emptyMilestone)
  const [assignForm, setAssignForm] = useState({ customer_id: '', tier_id: '' })
  const [editingTier, setEditingTier] = useState(null)
  const [editingMilestone, setEditingMilestone] = useState(null)
  const [weightDrafts, setWeightDrafts] = useState({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [tierRows, milestoneRows, serviceRows, settingsRow, customerRows, membershipRows] = await Promise.all([
      listMembershipTiers(),
      listLoyaltyMilestones({ includeInactive: true }),
      listServices({ includeArchived: false }),
      getLoyaltyProgramSettings(),
      listCustomersForMembership(),
      listActiveCustomerMemberships(),
    ])
    setTiers(tierRows)
    setMilestones(milestoneRows)
    setServices(serviceRows)
    setSettings(settingsRow)
    setProgramForm(settingsToProgramForm(settingsRow))
    setCustomers(customerRows)
    setActiveMemberships(membershipRows)
    setWeightDrafts(Object.fromEntries(serviceRows.map((s) => [s.id, String(s.loyalty_weight ?? 1)])))
  }, [])

  useEffect(() => {
    if (canAccessMemberships(profile)) load().catch((e) => toast.error(e.message))
  }, [load, profile])

  const activeTiers = useMemo(() => tiers.filter((t) => t.is_active), [tiers])

  if (!canAccessMemberships(profile)) return <Navigate to="/operations/access-denied" replace />

  async function onCreateTier(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await createMembershipTier(tierForm)
      toast.success('Membership tier created')
      setTierForm(emptyTier)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onSaveTier(event) {
    event.preventDefault()
    if (!editingTier) return
    setSaving(true)
    try {
      await updateMembershipTier(editingTier.id, editingTier)
      toast.success('Tier updated')
      setEditingTier(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleTierActive(tier) {
    try {
      await updateMembershipTier(tier.id, {
        name: tier.name,
        starting_price: Number(tier.starting_price_minor) / 100,
        discount_percent: tier.discount_percent,
        loyalty_multiplier: tier.loyalty_multiplier,
        benefits: tier.benefits,
        included_services: tier.included_services,
        is_active: !tier.is_active,
      })
      toast.success(tier.is_active ? 'Tier deactivated' : 'Tier activated')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onCreateMilestone(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await createLoyaltyMilestone(milestoneForm)
      toast.success('Milestone created')
      setMilestoneForm(emptyMilestone)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onSaveMilestone(event) {
    event.preventDefault()
    if (!editingMilestone) return
    setSaving(true)
    try {
      await updateLoyaltyMilestone(editingMilestone.id, editingMilestone)
      toast.success('Milestone updated')
      setEditingMilestone(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onSaveProgram(event) {
    event.preventDefault()
    if (!superAdmin) {
      toast.error('Only Super Admin can change loyalty program settings.')
      return
    }
    setSaving(true)
    try {
      await updateLoyaltyProgramSettings(programForm)
      toast.success('Loyalty program settings saved')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function togglePayCategory(value) {
    setProgramForm((f) => {
      const has = f.stamp_pay_categories.includes(value)
      const next = has
        ? f.stamp_pay_categories.filter((c) => c !== value)
        : [...f.stamp_pay_categories, value]
      return { ...f, stamp_pay_categories: next }
    })
  }

  async function saveServiceWeight(serviceId) {
    if (!superAdmin) {
      toast.error('Only Super Admin can edit service loyalty scores.')
      return
    }
    try {
      await updateServiceLoyaltyWeight(serviceId, weightDrafts[serviceId])
      toast.success('Service score updated')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onAssignMembership(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await assignCustomerMembership(assignForm)
      toast.success('Membership assigned')
      setAssignForm((f) => ({ ...f, customer_id: '' }))
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onRevokeMembership(id) {
    setSaving(true)
    try {
      await revokeCustomerMembership(id)
      toast.success('Membership revoked')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Membership</p>
        <h1 className="text-3xl font-semibold tracking-tight">Plans & loyalty</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Super Admin controls the whole loyalty program — stamps, points, memberships, carwash-only earn, and per-service scores. POS honors these settings live.
        </p>
      </div>

      <Tabs defaultValue={superAdmin ? 'program' : 'tiers'}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          {superAdmin ? (
            <TabsTrigger value="program"><Settings2 data-icon="inline-start" /> Program</TabsTrigger>
          ) : null}
          <TabsTrigger value="tiers"><Crown data-icon="inline-start" /> Premium plans</TabsTrigger>
          <TabsTrigger value="loyalty"><Gift data-icon="inline-start" /> Stamp thresholds</TabsTrigger>
          <TabsTrigger value="scoring"><Sparkles data-icon="inline-start" /> Service scoring</TabsTrigger>
          <TabsTrigger value="assign">Assign members</TabsTrigger>
        </TabsList>

        {superAdmin ? (
          <TabsContent value="program" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Loyalty program controls</CardTitle>
                <CardDescription>
                  Kill-switches and earn rules for stamps, spend points, and paid memberships. Changes apply on the next POS checkout.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSaveProgram} className="flex flex-col gap-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ['stamps_enabled', 'Stamp card', 'Customers earn stamps on paid services'],
                      ['points_enabled', 'Spend points', '₱1 of service spend ≈ 1 point × membership multiplier'],
                      ['memberships_enabled', 'Memberships', 'Paid tiers and multipliers stay active'],
                    ].map(([key, label, hint]) => (
                      <label key={key} className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <input
                            type="checkbox"
                            checked={!!programForm[key]}
                            onChange={(e) => setProgramForm({ ...programForm, [key]: e.target.checked })}
                          />
                          {label}
                        </span>
                        <span className="text-xs text-muted-foreground">{hint}</span>
                      </label>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="card-slots">Stamp card slots</Label>
                      <Input
                        id="card-slots"
                        type="number"
                        min="5"
                        max="50"
                        className="w-32"
                        value={programForm.card_slots}
                        onChange={(e) => setProgramForm({ ...programForm, card_slots: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Stamp earn mode</Label>
                      <Select
                        value={programForm.stamp_earn_mode}
                        onValueChange={(v) => setProgramForm({ ...programForm, stamp_earn_mode: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_weighted">All services with score &gt; 0</SelectItem>
                          <SelectItem value="pay_categories">Only selected categories (e.g. carwash)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {programForm.stamp_earn_mode === 'pay_categories' ? (
                    <div className="flex flex-col gap-2">
                      <Label>Categories that earn stamps</Label>
                      <div className="flex flex-wrap gap-3">
                        {LOYALTY_PAY_CATEGORIES.map((c) => (
                          <label key={c.value} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={programForm.stamp_pay_categories.includes(c.value)}
                              onChange={() => togglePayCategory(c.value)}
                            />
                            {c.label}
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tip: select Wash only for carwash-stamp programs. Per-service scores still apply inside those categories.
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={programForm.apply_membership_multiplier_to_stamps}
                        onChange={(e) =>
                          setProgramForm({ ...programForm, apply_membership_multiplier_to_stamps: e.target.checked })
                        }
                      />
                      <span>
                        <span className="font-medium">Multiply stamps by membership</span>
                        <span className="block text-xs text-muted-foreground">
                          Uses the member tier loyalty multiplier on stamp awards (not only spend points).
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={programForm.wrap_stamps_at_card}
                        onChange={(e) => setProgramForm({ ...programForm, wrap_stamps_at_card: e.target.checked })}
                      />
                      <span>
                        <span className="font-medium">Wrap stamp card when full</span>
                        <span className="block text-xs text-muted-foreground">
                          After a full card, balance rolls to stamps % slots (new card cycle).
                        </span>
                      </span>
                    </label>
                  </div>

                  <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save program settings'}</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="tiers" className="mt-6 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Add premium tier</CardTitle>
              <CardDescription>Paid membership plans with discount and loyalty multiplier on POS spend.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreateTier} className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Starting price (₱)</Label><Input required type="number" min="0" step="0.01" value={tierForm.starting_price} onChange={(e) => setTierForm({ ...tierForm, starting_price: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Discount %</Label><Input type="number" min="0" max="100" step="0.1" value={tierForm.discount_percent} onChange={(e) => setTierForm({ ...tierForm, discount_percent: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Loyalty multiplier</Label><Input type="number" min="0" max="10" step="0.1" value={tierForm.loyalty_multiplier} onChange={(e) => setTierForm({ ...tierForm, loyalty_multiplier: e.target.value })} /></div>
                <div className="flex flex-col gap-2 md:col-span-2"><Label>Benefits (one per line)</Label><Textarea rows={3} value={tierForm.benefits} onChange={(e) => setTierForm({ ...tierForm, benefits: e.target.value })} placeholder={'Priority booking\nMember-only promos'} /></div>
                <div className="flex flex-col gap-2 md:col-span-2"><Label>Included services (one per line)</Label><Textarea rows={2} value={tierForm.included_services} onChange={(e) => setTierForm({ ...tierForm, included_services: e.target.value })} placeholder="Premium Car Wash" /></div>
                <Button type="submit" className="md:col-span-2" disabled={saving}>{saving ? 'Saving…' : 'Create tier'}</Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {tiers.map((tier) => (
              <Card key={tier.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <CardTitle>{tier.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {tier.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditingTier({
                      ...tier,
                      starting_price: String(Number(tier.starting_price_minor) / 100),
                      discount_percent: String(tier.discount_percent),
                      loyalty_multiplier: String(tier.loyalty_multiplier),
                      benefits: (tier.benefits || []).join('\n'),
                      included_services: (tier.included_services || []).join('\n'),
                    })} aria-label={`Edit ${tier.name}`}>
                      <Pencil />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-3xl font-semibold">{formatMoney(tier.starting_price_minor)}</p>
                  <p className="text-sm text-muted-foreground">Loyalty multiplier ×{tier.loyalty_multiplier} · {tier.discount_percent}% off</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {(tier.benefits || []).map((b) => <li key={b}>{b}</li>)}
                  </ul>
                  <p className="text-xs text-muted-foreground">Includes: {(tier.included_services || []).join(', ') || '—'}</p>
                  <Button variant="outline" size="sm" onClick={() => toggleTierActive(tier)}>
                    {tier.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {!tiers.length && <p className="text-sm text-muted-foreground">No tiers yet — create your first plan above.</p>}
          </div>
        </TabsContent>

        <TabsContent value="loyalty" className="mt-6 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Stamp card</CardTitle>
              <CardDescription>
                {superAdmin
                  ? `Card capacity is ${settings.card_slots} slots — change it under Program.`
                  : `Card capacity: ${settings.card_slots} weighted stamps (Super Admin sets this under Program).`}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add stamp threshold</CardTitle>
              <CardDescription>When a customer reaches this stamp total on their card, they unlock the reward. (Spend points are separate — toggled under Program.)</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreateMilestone} className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>Threshold stamps</Label><Input required type="number" min="1" step="1" value={milestoneForm.threshold_points} onChange={(e) => setMilestoneForm({ ...milestoneForm, threshold_points: e.target.value })} placeholder="10" /></div>
                <div className="flex flex-col gap-2"><Label>Sort order</Label><Input type="number" min="0" value={milestoneForm.sort_order} onChange={(e) => setMilestoneForm({ ...milestoneForm, sort_order: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Reward label</Label><Input required value={milestoneForm.reward_label} onChange={(e) => setMilestoneForm({ ...milestoneForm, reward_label: e.target.value })} placeholder="Free wash" /></div>
                <div className="flex flex-col gap-2"><Label>Description</Label><Input value={milestoneForm.reward_description} onChange={(e) => setMilestoneForm({ ...milestoneForm, reward_description: e.target.value })} placeholder="Complimentary standard wash" /></div>
                <Button type="submit" className="md:col-span-2" disabled={saving}><Plus data-icon="inline-start" /> Add milestone</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Active thresholds</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stamps</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {milestones.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.threshold_points}</TableCell>
                      <TableCell>{row.reward_label}</TableCell>
                      <TableCell className="text-muted-foreground">{row.reward_description || '—'}</TableCell>
                      <TableCell>{row.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditingMilestone({
                          ...row,
                          threshold_points: String(row.threshold_points),
                          sort_order: String(row.sort_order ?? 0),
                        })}>
                          <Pencil data-icon="inline-start" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!milestones.length && (
                    <TableRow><TableCell colSpan={5} className="text-muted-foreground">No milestones — add thresholds like “10 points = free wash”.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Service loyalty scores</CardTitle>
              <CardDescription>
                {superAdmin
                  ? 'Set how many stamp points each service earns per unit. Combined with Program earn mode (all weighted vs wash-only categories).'
                  : 'Only Super Admin (BossMich) can edit scores. You can review current weights below.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Loyalty score</TableHead>
                    {superAdmin ? <TableHead className="text-right">Save</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{row.pay_category || 'general'}</TableCell>
                      <TableCell>{formatSizePriceRange(row, formatMoney)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          className="w-24"
                          disabled={!superAdmin}
                          readOnly={!superAdmin}
                          value={weightDrafts[row.id] ?? '1'}
                          onChange={(e) => setWeightDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                        />
                      </TableCell>
                      {superAdmin ? (
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => saveServiceWeight(row.id)}>Save</Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {!services.length && (
                    <TableRow>
                      <TableCell colSpan={superAdmin ? 5 : 4} className="text-muted-foreground">
                        No active services — add services first.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assign" className="mt-6 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign premium membership</CardTitle>
              <CardDescription>
                Link a customer to a paid tier for POS loyalty multipliers
                {settings.memberships_enabled === false ? ' (memberships are currently disabled in Program).' : '.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onAssignMembership} className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Customer</Label>
                  <Select value={assignForm.customer_id} onValueChange={(v) => setAssignForm({ ...assignForm, customer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name || c.email || c.phone} · {c.loyalty_stamps ?? 0} stamps
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Tier</Label>
                  <Select value={assignForm.tier_id} onValueChange={(v) => setAssignForm({ ...assignForm, tier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                    <SelectContent>
                      {activeTiers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="md:col-span-2" disabled={saving || !assignForm.customer_id || !assignForm.tier_id}>
                  Assign membership
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active memberships</CardTitle>
              <CardDescription>Revoke to stop multipliers immediately on the next sale.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Ends</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeMemberships.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.customers?.full_name || row.customers?.email || row.customers?.phone || row.customer_id}
                      </TableCell>
                      <TableCell>{row.membership_tiers?.name || '—'}</TableCell>
                      <TableCell>{row.starts_at || '—'}</TableCell>
                      <TableCell>{row.ends_at || 'Open'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => onRevokeMembership(row.id)}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!activeMemberships.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">No active memberships.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingTier} onOpenChange={(open) => !open && setEditingTier(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit tier</DialogTitle></DialogHeader>
          {editingTier && (
            <form onSubmit={onSaveTier} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={editingTier.name} onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Starting price (₱)</Label><Input required type="number" min="0" step="0.01" value={editingTier.starting_price} onChange={(e) => setEditingTier({ ...editingTier, starting_price: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Discount %</Label><Input type="number" min="0" max="100" value={editingTier.discount_percent} onChange={(e) => setEditingTier({ ...editingTier, discount_percent: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Loyalty multiplier</Label><Input type="number" min="0" max="10" step="0.1" value={editingTier.loyalty_multiplier} onChange={(e) => setEditingTier({ ...editingTier, loyalty_multiplier: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Benefits</Label><Textarea rows={3} value={editingTier.benefits} onChange={(e) => setEditingTier({ ...editingTier, benefits: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Included services</Label><Textarea rows={2} value={editingTier.included_services} onChange={(e) => setEditingTier({ ...editingTier, included_services: e.target.value })} /></div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!editingTier.is_active}
                  onChange={(e) => setEditingTier({ ...editingTier, is_active: e.target.checked })}
                />
                Active
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTier(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>Save changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingMilestone} onOpenChange={(open) => !open && setEditingMilestone(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit milestone</DialogTitle></DialogHeader>
          {editingMilestone && (
            <form onSubmit={onSaveMilestone} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label>Threshold stamps</Label><Input required type="number" min="1" value={editingMilestone.threshold_points} onChange={(e) => setEditingMilestone({ ...editingMilestone, threshold_points: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Reward label</Label><Input required value={editingMilestone.reward_label} onChange={(e) => setEditingMilestone({ ...editingMilestone, reward_label: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Description</Label><Input value={editingMilestone.reward_description || ''} onChange={(e) => setEditingMilestone({ ...editingMilestone, reward_description: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Sort order</Label><Input type="number" min="0" value={editingMilestone.sort_order} onChange={(e) => setEditingMilestone({ ...editingMilestone, sort_order: e.target.value })} /></div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!editingMilestone.is_active}
                  onChange={(e) => setEditingMilestone({ ...editingMilestone, is_active: e.target.checked })}
                />
                Active
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingMilestone(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>Save changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
