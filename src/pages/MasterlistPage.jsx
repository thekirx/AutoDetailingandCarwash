import { useCallback, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { CarFront, Download, MapPin, RefreshCw, Search, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

function formatContact(profile) {
  return [profile.phone, profile.email].filter(Boolean).join(' · ') || '—'
}

function formatVehicle(booking) {
  if (!booking) return '—'
  const vehicle = [booking.vehicle_year, booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ')
  return booking.vehicle_plate ? `${vehicle} · ${booking.vehicle_plate}` : vehicle || '—'
}

function buildRows(customers, transactions) {
  const activity = new Map()

  for (const transaction of transactions) {
    const current = activity.get(transaction.customer_id) || {
      bookingIds: new Set(),
      lifetimeSpendMinor: 0,
      latestVehicle: null,
      latestVehicleAt: 0,
    }

    if (transaction.booking_id) current.bookingIds.add(transaction.booking_id)

    if (transaction.type === 'sale' || transaction.type === 'adjustment') {
      current.lifetimeSpendMinor += transaction.amount_minor
    } else if (transaction.type === 'refund') {
      current.lifetimeSpendMinor -= transaction.amount_minor
    }

    const occurredAt = new Date(transaction.occurred_at).getTime()
    if (transaction.booking && occurredAt >= current.latestVehicleAt) {
      current.latestVehicle = transaction.booking
      current.latestVehicleAt = occurredAt
    }

    activity.set(transaction.customer_id, current)
  }

  return customers.map((customer) => {
    const customerActivity = activity.get(customer.id)
    return {
      id: customer.id,
      name: customer.full_name,
      contact: formatContact(customer),
      vehicle: formatVehicle(customerActivity?.latestVehicle),
      branch: customerActivity?.latestVehicle?.branch || '',
      vehicleType: customerActivity?.latestVehicle?.vehicle_type || '',
      totalVisits: customerActivity?.bookingIds.size || 0,
      lifetimeSpendMinor: customerActivity?.lifetimeSpendMinor || 0,
    }
  })
}

export default function MasterlistPage() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    setError('')

    const [customersResult, transactionsResult] = await Promise.all([
      supabase
        .from('customers')
        .select('id, full_name, email, phone')
        .eq('role', 'customer')
        .eq('is_archived', false)
        .order('full_name'),
      supabase
        .from('transactions')
        .select(`
          customer_id,
          booking_id,
          type,
          amount_minor,
          occurred_at,
          booking:bookings!transactions_booking_id_fkey (
            vehicle_make,
            vehicle_model,
            vehicle_year,
            vehicle_plate,
            vehicle_type,
            branch
          )
        `)
        .eq('is_archived', false)
        .not('customer_id', 'is', null)
        .order('occurred_at', { ascending: false }),
    ])

    if (customersResult.error || transactionsResult.error) {
      setError(customersResult.error?.message || transactionsResult.error?.message || 'Unable to load customer data.')
      setLoading(false)
      return
    }

    setRows(buildRows(customersResult.data, transactionsResult.data))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()

    return rows.filter((row) => {
      const matchesBranch = branchFilter === 'all' || row.branch === branchFilter
      const matchesVehicleType = vehicleTypeFilter === 'all' || row.vehicleType === vehicleTypeFilter
      const searchableText = [row.name, row.contact, row.vehicle, row.branch, row.vehicleType, row.totalVisits, row.lifetimeSpendMinor / 100]
        .join(' ')
        .toLocaleLowerCase()

      return matchesBranch && matchesVehicleType && (!query || searchableText.includes(query))
    })
  }, [rows, search, branchFilter, vehicleTypeFilter])

  const exportCsv = () => {
    const csv = Papa.unparse(
      visibleRows.map((row) => ({
        Name: row.name,
        Contact: row.contact,
        Vehicle: row.vehicle,
        Branch: row.branch || '—',
        'Vehicle Type': row.vehicleType || '—',
        'Total Visits': row.totalVisits,
        'Lifetime Spend (PHP)': (row.lifetimeSpendMinor / 100).toFixed(2),
      })),
    )
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hakum-customer-masterlist-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="mb-2 text-xs tracking-[0.22em] text-lime-400 uppercase">Customer intelligence</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Customer Masterlist</h1>
          <p className="mt-3 text-slate-400">Search customer relationships, visit history, and lifetime value.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={visibleRows.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 py-3 font-semibold text-[#090d12] shadow-[0_10px_30px_rgba(163,230,53,.13)] transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={19} /> Export to CSV
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-white/8 bg-[#10161e] shadow-xl shadow-black/10">
        <div className="flex flex-col gap-3 border-b border-white/8 p-4 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search all customer columns</span>
            <Search className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, contact, vehicle, visits, or spend…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.035] py-3 pr-4 pl-11 text-sm outline-none transition placeholder:text-slate-600 focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/10"
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-slate-300">
            <MapPin size={17} className="text-slate-500" />
            <span className="sr-only">Filter by branch</span>
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="min-w-40 bg-transparent py-3 outline-none"
            >
              <option value="all">All branches</option>
              <option value="bacoor">Bacoor</option>
              <option value="batangas">Batangas</option>
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-slate-300">
            <CarFront size={17} className="text-slate-500" />
            <span className="sr-only">Filter by vehicle type</span>
            <select
              value={vehicleTypeFilter}
              onChange={(event) => setVehicleTypeFilter(event.target.value)}
              className="min-w-40 bg-transparent py-3 outline-none"
            >
              <option value="all">All vehicle types</option>
              <option value="sedan">Sedan</option>
              <option value="suv">SUV</option>
              <option value="pickup">Pickup</option>
              <option value="van">Van</option>
              <option value="motorcycle">Motorcycle</option>
              <option value="other">Other</option>
            </select>
          </label>

          <button type="button" onClick={loadCustomers} disabled={loading} className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Refresh customer data">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {error ? (
          <div className="p-10 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button type="button" onClick={loadCustomers} className="mt-4 text-sm font-medium text-lime-400 hover:text-lime-300">Try again</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-white/[0.025] text-[11px] tracking-[0.15em] text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Contact</th>
                  <th className="px-6 py-4 font-medium">Vehicle</th>
                  <th className="px-6 py-4 text-right font-medium">Total Visits</th>
                  <th className="px-6 py-4 text-right font-medium">Lifetime Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {loading ? (
                  Array.from({ length: 5 }, (_, index) => (
                    <tr key={index} className="animate-pulse">
                      {Array.from({ length: 5 }, (__, cell) => <td key={cell} className="px-6 py-5"><div className="h-4 rounded bg-white/5" /></td>)}
                    </tr>
                  ))
                ) : visibleRows.length > 0 ? (
                  visibleRows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.025]">
                      <td className="px-6 py-5"><div className="flex items-center gap-3"><span className="size-2 rounded-full bg-lime-400 shadow-[0_0_10px_#a3e635]" /><span className="font-medium text-slate-100">{row.name}</span></div></td>
                      <td className="px-6 py-5 text-sm text-slate-400">{row.contact}</td>
                      <td className="px-6 py-5 text-sm text-slate-300">{row.vehicle}</td>
                      <td className="px-6 py-5 text-right font-medium tabular-nums">{row.totalVisits}</td>
                      <td className="px-6 py-5 text-right font-semibold text-lime-300 tabular-nums">{currencyFormatter.format(row.lifetimeSpendMinor / 100)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" className="px-6 py-16 text-center"><Users className="mx-auto mb-3 text-slate-600" /><p className="text-sm text-slate-400">No customers match these filters.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && (
          <div className="border-t border-white/8 px-6 py-4 text-xs text-slate-500">
            Showing {visibleRows.length} of {rows.length} customers · CSV export follows the current filters
          </div>
        )}
      </div>
    </section>
  )
}
