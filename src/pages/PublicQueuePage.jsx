import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Activity, Clock3, Radio, Wifi } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ACTIVE_QUEUE_STATUSES, STATUS_LABELS, buildPublicQueueModel } from '../queue/queueLogic'

const branchFallbacks = {
  bacoor: { name: 'Bacoor', address: 'RFC Mall, Bacoor' },
  batangas: { name: 'Batangas', address: 'Batangas City' },
}

const statCards = [
  ['waiting', 'Waiting', 'from-blue-500/25 to-blue-950/35'],
  ['in_progress', 'In Progress', 'from-emerald-400/25 to-emerald-950/35'],
  ['final_checking', 'For Final Checking', 'from-amber-300/25 to-amber-950/35'],
  ['total', 'Total Active Queue', 'from-slate-200/15 to-blue-950/35'],
]

export default function PublicQueuePage() {
  const { branch } = useParams()
  const [branchDetails, setBranchDetails] = useState(null)
  const [countsRow, setCountsRow] = useState(null)
  const [numberRows, setNumberRows] = useState([])
  const [now, setNow] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const validBranch = branchFallbacks[branch]

  const loadQueue = useCallback(async () => {
    if (!validBranch) return
    setError('')

    const [branchResult, countsResult, numbersResult] = await Promise.all([
      supabase
        .from('branches')
        .select('slug, name, address')
        .eq('slug', branch)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('public_queue_counts')
        .select('branch, waiting_count, in_progress_count, final_checking_count, total_active_count')
        .eq('branch', branch)
        .maybeSingle(),
      supabase
        .from('public_queue_numbers')
        .select('branch, queue_number, status')
        .eq('branch', branch)
        .in('status', ACTIVE_QUEUE_STATUSES)
        .order('queue_number'),
    ])

    if (branchResult.error || countsResult.error || numbersResult.error) {
      setError(branchResult.error?.message || countsResult.error?.message || numbersResult.error?.message || 'Unable to load queue.')
      setLoading(false)
      return
    }

    setBranchDetails(branchResult.data || branchFallbacks[branch])
    setCountsRow(countsResult.data)
    setNumberRows(numbersResult.data || [])
    setLoading(false)
  }, [branch, validBranch])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!validBranch) return undefined
    const channel = supabase
      .channel(`public-queue-${branch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `branch=eq.${branch}` }, () => {
        loadQueue()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branch, loadQueue, validBranch])

  const publicModel = useMemo(() => buildPublicQueueModel(numberRows, branch), [numberRows, branch])
  const counts = useMemo(() => ({
    waiting: countsRow?.waiting_count ?? publicModel.counts.waiting,
    in_progress: countsRow?.in_progress_count ?? publicModel.counts.in_progress,
    final_checking: countsRow?.final_checking_count ?? publicModel.counts.final_checking,
    total: countsRow?.total_active_count ?? publicModel.counts.total,
  }), [countsRow, publicModel])

  if (!branch) return <Navigate to="/queue/bacoor" replace />
  if (!validBranch) return <Navigate to="/queue/bacoor" replace />

  return (
    <section className="min-h-screen bg-[#020817] px-4 py-24 text-white sm:px-6 lg:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(37,99,235,.32),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(14,165,233,.16),transparent_26%),linear-gradient(135deg,#020817_0%,#041a48_48%,#020817_100%)]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/" className="mb-7 inline-flex items-center gap-3 text-white no-underline">
              <span className="grid h-11 w-14 -skew-x-12 place-items-center border-2 border-white text-xl font-black italic">H</span>
              <span className="text-sm font-black tracking-[0.18em] uppercase">Hakum Auto Care</span>
            </Link>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.22em] text-blue-200 uppercase"><Radio size={15} /> Live Queue</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{branchDetails?.name || validBranch.name}</h1>
            <p className="mt-3 text-sm text-slate-300">{branchDetails?.address || validBranch.address}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-xl">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">Local time</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums"><Clock3 size={18} />{now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-emerald-100 backdrop-blur-xl">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase">Status</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><Wifi size={17} /><span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,.8)]" />Online</p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-10 rounded-3xl border border-red-300/20 bg-red-500/10 p-8 text-red-100">
            <p>{error}</p>
            <button type="button" onClick={loadQueue} className="mt-4 font-semibold text-white">Try again</button>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map(([key, label, gradient]) => (
                <article key={key} className={`rounded-3xl border border-white/10 bg-gradient-to-br ${gradient} p-6 shadow-2xl shadow-black/20 backdrop-blur-xl`}>
                  <p className="text-xs font-bold tracking-[0.16em] text-slate-300 uppercase">{label}</p>
                  {loading ? <div className="mt-6 h-12 w-24 animate-pulse rounded-xl bg-white/10" /> : <p className="mt-5 text-5xl font-black tabular-nums">{counts[key]}</p>}
                  <p className="mt-2 text-sm text-slate-400">{counts[key] === 1 ? 'Vehicle' : 'Vehicles'}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/7 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.18em] text-blue-200 uppercase">Queue Numbers</p>
                  <h2 className="mt-1 text-2xl font-bold">Now on the floor</h2>
                </div>
                <Activity className="text-blue-200" />
              </div>

              {loading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/8" />)}
                </div>
              ) : counts.total === 0 ? (
                <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-white/12 text-center text-slate-400">No vehicles currently in queue</div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-3">
                  {ACTIVE_QUEUE_STATUSES.map((status) => (
                    <section key={status} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                      <h3 className="mb-4 text-xs font-bold tracking-[0.16em] text-slate-300 uppercase">{STATUS_LABELS[status]}</h3>
                      <div className="grid gap-2">
                        {publicModel.groups[status].length ? publicModel.groups[status].map((item) => (
                          <div key={`${status}-${item.queueNumber}`} className="flex items-center justify-between rounded-xl bg-white/8 px-4 py-3">
                            <span className="text-2xl font-black tabular-nums">{item.queueNumber}</span>
                            <span className="size-2 rounded-full bg-blue-300" />
                          </div>
                        )) : <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-500">No active numbers</p>}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
