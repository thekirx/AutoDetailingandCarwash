import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, MapPin } from 'lucide-react'
import { Row, SectionHead } from './CustomerUi'
import Sheet from './Sheet'
import { branchLabel, fetchPortal, portalAction } from '@/lib/customerPortalClient'
import { claimState, merchPhoto, pickupPath, shopItems } from '@/lib/pointsShop'
import { branchOnHand } from '@/lib/inventoryBranchStock'
import { productSizeRows } from '@/lib/productSizes'

export default function PointsShop({ data, onRefresh }) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState('')
  const [branch, setBranch] = useState('')
  const [size, setSize] = useState('')
  const [chooseBranch, setChooseBranch] = useState(false)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState('')
  const items = shopItems(data.rewards?.shop || [])
  const branches = data.branches || []
  const pickup = branch || branches[0]?.slug || ''
  const points = Number(data.loyalty?.loyaltyPoints) || 0
  const item = items.find((p) => p.id === selected)
  const sizes = productSizeRows(item)
  const state = claimState(item, pickup, size, points, busy)
  const waiting = (data.rewards?.redemptions || []).filter((r) => r.status === 'pending')
  function open(row) { setSelected(row.id); setSize(''); setError(''); setChooseBranch(false) }
  async function claim() {
    if (!state.canClaim || submitting.current) return
    submitting.current = true
    setBusy(true); setError('')
    try {
      const result = await portalAction('redeem-accessory', { product_id: item.id, branch_slug: pickup, size })
      navigate(pickupPath(result.id))
    } catch (err) {
      setError(err.message)
      fetchPortal().then(onRefresh).catch(() => {})
    } finally { setBusy(false); submitting.current = false }
  }
  return <>
    {data.loyalty?.pointsEnabled ? <section className="capp-section" aria-label="Points shop">
      <SectionHead title="Points shop" note={`${points} points`} />
      <div className="capp-group">
        {items.map((row) => {
          const available = branches.find((b) => row.product_branch_stock?.some((s) => s.branch_slug === b.slug && Number(s.qty) > 0))
          return <Row key={row.id} thumb={merchPhoto(row)} title={row.name}
            sub={`${row.points_price} points · ${available ? `In stock at ${branchLabel(branches, available.slug)}` : 'Out of stock'}`}
            chevron onClick={() => open(row)} />
        })}
        {!items.length ? <p className="capp-empty">Nothing is in the shop yet.</p> : null}
      </div>
    </section> : null}
    {waiting.length ? <section className="capp-section" aria-label="Ready for pickup">
      <SectionHead title="Ready for pickup" />
      <div className="capp-group">{waiting.map((row) => <Row key={row.id} icon={Gift}
        title={row.products?.name || 'Your item'} sub={`${branchLabel(branches, row.branch_slug)} · View your pickup code`}
        to={pickupPath(row.id)} chevron />)}</div>
    </section> : null}
    <Sheet open={Boolean(item)} onClose={() => { if (!busy) setSelected('') }} title={item?.name}
      footer={item ? <button type="button" className="capp-btn capp-btn-fill capp-btn-block" disabled={!state.canClaim} onClick={claim}>
        {busy ? 'Setting it aside…' : `Use ${item.points_price} points`}
      </button> : null}>
      {item ? <>
        <img className="capp-shop-photo" src={merchPhoto(item)} alt={item.photo_url ? item.name : `${item.name} — placeholder photo`} />
        <p className="capp-meta mt-3">{item.description || 'Hakum photo and description coming soon.'} Same points for every size.</p>
        {sizes.length ? <>
          <SectionHead title="Size" />
          <div className="capp-pills" role="group" aria-label="Size">{sizes.map((s) => {
            const out = !(branchOnHand(item.product_branch_stock, pickup, s.size_key) > 0)
            return <button key={s.size_key} type="button" aria-pressed={size === s.size_key}
              className={`capp-pill-btn${size === s.size_key ? ' is-active' : ''}`} disabled={out || busy}
              style={out ? { textDecoration: 'line-through', opacity: .4 } : undefined}
              onClick={() => setSize(s.size_key)}>{s.label}</button>
          })}</div>
          <p className="capp-meta mt-2">Sizes crossed out are out at {branchLabel(branches, pickup)}.</p>
        </> : null}
        <SectionHead title="Pick up at" />
        <Row icon={MapPin} className="capp-branch-pick" title={branchLabel(branches, pickup) || 'Choose a branch'} sub="Where you'll pick it up"
          end="Change" onClick={() => setChooseBranch(!chooseBranch)} />
        {chooseBranch ? <div className="capp-group" role="group" aria-label="Pickup branch">{branches.map((b) => <Row key={b.slug} title={branchLabel(branches, b.slug)}
          onClick={() => { setBranch(b.slug); setSize(''); setChooseBranch(false) }} />)}</div> : null}
        <div className="capp-group mt-3">
          <Row title="Your points" end={String(points)} />
          <Row title={`${item.name}${size ? ` · ${sizes.find((s) => s.size_key === size)?.label || size}` : ''}`} end={`−${item.points_price}`} />
          <Row title="Left after" sub="We keep it for you for 10 days" end={String(state.left)} />
        </div>
        <p className="capp-meta mt-3">Using points can’t be undone. If you don’t pick it up, your points come back after 10 days.</p>
        {state.left < 0 ? <p className="capp-meta mt-2">You need {Math.abs(state.left)} more points.</p> : null}
        {error ? <p role="alert" className="capp-meta mt-2">{error}</p> : null}
      </> : null}
    </Sheet>
  </>
}
