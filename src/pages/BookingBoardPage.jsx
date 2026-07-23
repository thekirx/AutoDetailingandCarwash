import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessBookingBoard } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const COLUMNS = [
  { id: 'pending', label: 'New Booking' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

export default function BookingBoardPage() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_phone, branch, status, scheduled_start, assigned_staff_id, notes, vehicle_make, vehicle_model')
      .eq('is_archived', false)
      .order('scheduled_start', { ascending: false })
      .limit(200)
    if (error) toast.error(error.message)
    setBookings(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

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

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Bookings</p>
        <h1 className="text-3xl font-semibold tracking-tight">Booking board</h1>
        <p className="mt-2 text-muted-foreground">Trello-style columns — use actions to move cards.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {COLUMNS.map((col) => (
          <Card key={col.id} className="min-h-80">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                {col.label}
                <Badge variant="secondary">{grouped[col.id].length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {grouped[col.id].map((booking) => (
                <article key={booking.id} className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="font-medium">{booking.customer_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {booking.branch} · {[booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(booking.scheduled_start).toLocaleString()}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {COLUMNS.filter((c) => c.id !== booking.status).slice(0, 3).map((c) => (
                      <Button key={c.id} size="sm" variant="outline" onClick={() => move(booking, c.id)}>
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
