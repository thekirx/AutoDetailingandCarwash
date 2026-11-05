import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Gift } from 'lucide-react'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { Badge, Row, SectionHead, Skeleton } from '@/components/customer/CustomerUi'
import { branchLabel, fetchPortal } from '@/lib/customerPortalClient'
import { merchPhoto, pickupDate, pickupDaysLeft } from '@/lib/pointsShop'
import { usePageMeta } from '@/lib/pageMeta'

export default function CustomerPickupPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  usePageMeta({ title: 'Pickup pass', description: 'Show this code at the counter.', path: `/account/pickup/${id}` })
  useEffect(() => { fetchPortal().then(setData).catch((err) => setError(err.message)) }, [id])
  const rows = data?.rewards?.redemptions || []
  const row = rows.find((r) => r.id === id)
  const branch = branchLabel(data?.branches, row?.branch_slug)
  const days = pickupDaysLeft(row?.expires_at)
  return <CustomerAppFrame title={row?.status === 'pending' ? 'Ready for pickup' : 'Pickup pass'} subtitle="Show this code at the counter.">
    {!data && !error ? <Skeleton n={2} /> : null}
    {error ? <p className="capp-empty" role="alert">{error}</p> : null}
    {data && !row ? <p className="capp-empty">Pickup pass not found. <Link to="/account/loyalty">Back to Rewards</Link></p> : null}
    {row ? <>
      <section className="capp-card capp-pass" aria-label="Pickup pass">
        <div className="capp-pass-head"><img src="/branding/hakum-mark-ow.png" alt="" width="44" height="44" /><span>Pickup pass</span></div>
        <p className="capp-count capp-pass-count capp-pickup-code"><b>{row.status === 'pending' && days ? row.pickup_code : row.status === 'fulfilled' ? 'Picked up' : 'Expired'}</b></p>
        <p className="capp-pass-line">{row.products?.name || 'Hakum merch'}{row.size_key ? ` · Size ${row.size_key.toUpperCase()}` : ''} · {row.points_spent} points used</p>
        <div className="capp-pass-foot"><span><b>{branch}</b>Pick up at</span><span className="is-end"><b>{pickupDate(row.expires_at)}</b>Keep until</span></div>
      </section>
      <div className="capp-group"><Row icon={Gift}
        title={row.status === 'fulfilled' ? 'Picked up' : row.status === 'expired' ? `${row.points_spent} points returned` : days ? `${days} ${days === 1 ? 'day' : 'days'} left to pick up` : 'Your hold has ended'}
        sub={row.status === 'pending' ? `Not picked up by ${pickupDate(row.expires_at)}? Your ${row.points_spent} points come back automatically. This claim can’t be undone.` : row.status === 'fulfilled' ? `Collected at ${branch} · ${pickupDate(row.fulfilled_at)}` : 'Your item is back in stock.'} /></div>
    </> : null}
    {data ? <section className="capp-section" aria-label="Pickup history"><SectionHead title="History" />
      <div className="capp-group">{rows.filter((r) => r.status !== 'pending').map((r) => <Row key={r.id} thumb={merchPhoto(r.products)} title={r.products?.name || 'Hakum merch'}
        sub={r.status === 'fulfilled' ? `Picked up at ${branchLabel(data.branches, r.branch_slug)} · ${pickupDate(r.fulfilled_at || r.created_at)}` : `Not picked up · ${r.points_spent} points back`}
        end={<Badge tone={r.status === 'fulfilled' ? 'ok' : ''} label={r.status === 'fulfilled' ? 'Picked up' : 'Expired'} />} />)}
        {!rows.some((r) => r.status !== 'pending') ? <p className="capp-empty">No past pickups yet.</p> : null}
      </div>
    </section> : null}
  </CustomerAppFrame>
}
