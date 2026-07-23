import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessBookingBoard } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { getBranchScope, requiresTeamLeadBranchSetup } from '@/queue/queueLogic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const COLUMNS = [
  { id: 'pending', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'completed', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
]

export default function BookingBoardPage() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([])
  const branchScope = getBranchScope(profile)

  const load = useCallback(async () => {
    let query = supabase
      .from('bookings')
      .select('id, customer_name, customer_phone, branch, status, scheduled_start, assigned_staff_id, notes, vehicle_make, vehicle_model, vehicle_plate')
      .eq('is_archived', false)
      .order('scheduled_start', { ascending: false })
      .limit(200)
    if (branchScope) query = query.eq('branch', branchScope)
    const { data, error } = await query
    if (error) toast.error(error.message)
    setBookings(data || [])
  }, [branchScope])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`booking-board-${branchScope || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, branchScope])

  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c.id, []]))
    for (const booking of bookings) {
      const key = map[booking.status] ? booking.status : 'pending'
      map[key].push(booking)
    }
    return map
  }, [bookings])

  async function move(booking, status) {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      toast.error('Sign in required')
      return
    }
    const res = await fetch('/api/booking-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ booking_id: booking.id, status }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(body.error || 'Unable to update booking')
      return
    }
    toast.success(`Moved to ${status}${body.notify?.sms?.ok ? ' · SMS sent' : ''}`)
    load()
  }

  if (!canAccessBookingBoard(profile)) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) {
    return (
      <section className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-6 text-amber-100">
        Branch setup required before viewing bookings.
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="floor-compact-header">
        <p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-primary uppercase">Bookings</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Booking board</h1>
        <p className="floor-desc mt-1 text-sm text-muted-foreground">
          {branchScope ? `Branch · ${branchScope}` : 'All branches'} — tap actions to move cards. Live.
        </p>
      </div>
      <div className="floor-lane-board" role="region" aria-label="Booking columns">
        {COLUMNS.map((col) => (
          <section key={col.id} className="floor-lane" aria-label={col.label}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold tracking-[0.14em] text-slate-300 uppercase">{col.label}</h2>
              <Badge variant="secondary">{grouped[col.id].length}</Badge>
            </div>
            <div className="floor-lane-body">
              {grouped[col.id].map((booking) => (
                <article key={booking.id} className="floor-ticket !cursor-default">
                  <p className="font-medium">{booking.customer_name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {booking.vehicle_plate ? `${booking.vehicle_plate} · ` : ''}
                    {booking.branch} · {[booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(booking.scheduled_start).toLocaleString()}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {COLUMNS.filter((c) => c.id !== booking.status).slice(0, 3).map((c) => (
                      <Button key={c.id} size="sm" variant="outline" className="min-h-10 cursor-pointer" onClick={() => move(booking, c.id)}>
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </article>
              ))}
              {!grouped[col.id].length && (
                <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">Empty</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
