import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { SectionHead, Skeleton } from '@/components/customer/CustomerUi'
import { fetchPortal, portalAction } from '@/lib/customerPortalClient'
import { CUSTOMER_VOUCHERS_PATH } from '@/lib/customerAccountNav'
import { branchOnHand } from '@/lib/inventoryBranchStock'
import { pointsLabel } from '@/lib/loyaltyPoints'
import { customerVoucherRulesLine } from '@/lib/promoVoucher'
import { usePageMeta } from '@/lib/pageMeta'
import { formatMoney } from '@/queue/queueApi'

/** /account/vouchers — birthday car wash on the birthday, and the points shop. */
export default function CustomerVouchersPage() {
  usePageMeta({
    title: 'Vouchers',
    description: 'Claim a birthday car wash, or spend points on accessories and sellables.',
    path: CUSTOMER_VOUCHERS_PATH,
  })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [branch, setBranch] = useState('')
  const [voucherInput, setVoucherInput] = useState('')
  const [verifiedVoucher, setVerifiedVoucher] = useState(null)
  const [voucherCheckError, setVoucherCheckError] = useState('')

  async function checkVoucherCode(e) {
    e.preventDefault()
    const code = voucherInput.trim().toUpperCase()
    if (!code) return
    setBusy('check-voucher')
    setVoucherCheckError('')
    try {
      const res = await portalAction('check-voucher', { code })
      if (res?.ok && res.voucher) {
        setVerifiedVoucher(res.voucher)
        toast.success(`Voucher ${res.voucher.code} is valid!`)
        setData((prev) => {
          if (!prev) return prev
          const active = prev.vouchers?.active || []
          if (active.some((v) => v.code === res.voucher.code)) return prev
          return {
            ...prev,
            vouchers: {
              ...prev.vouchers,
              active: [res.voucher, ...active],
            },
          }
        })
      } else {
        throw new Error(res?.error || 'Voucher not found')
      }
    } catch (err) {
      setVoucherCheckError(err.message || 'That voucher code could not be verified.')
      toast.error(err.message || 'Voucher code not found')
    } finally {
      setBusy('')
    }
  }

  function reload() {
    return fetchPortal().then(setData).catch((err) => setError(err.message))
  }

  useEffect(() => {
    reload()
  }, [])

  const birthday = data?.birthday
  const promoActive = data?.vouchers?.active || []
  const promoHistory = data?.vouchers?.history || []
  const points = Number(data?.loyalty?.loyaltyPoints) || 0
  const shop = data?.rewards?.shop || []
  const redemptions = data?.rewards?.redemptions || []
  const branches = data?.branches || []
  const pickup = branch || branches[0]?.slug || ''
  const pickupName = branches.find((row) => row.slug === pickup)?.name || 'the branch'
  const ready = Boolean(birthday?.perk)
  const used = Boolean(birthday?.used)
  const isToday = Boolean(birthday?.is_today)
  const canClaim = isToday && Boolean(birthday?.date_of_birth) && !used

  async function claimBirthday() {
    setBusy('birthday')
    try {
      await portalAction('claim-birthday')
      toast.success('Birthday car wash is ready. Show this at the branch.')
      await reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  async function redeem(product) {
    if (!pickup) return
    setBusy(product.id)
    try {
      await portalAction('redeem-accessory', { product_id: product.id, branch_slug: pickup })
      toast.success(`${product.name} is saved. Pick it up at ${pickupName}.`)
      await reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <CustomerAppFrame title="Vouchers" subtitle="Birthday wash and the points shop." cols>
      {error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>{error}</strong>
        </div>
      ) : null}
      {!data && !error ? (
        <div className="capp-span">
          <Skeleton n={3} />
        </div>
      ) : null}
      {data ? (
        <>
          <section className="capp-card" aria-label="Birthday car wash">
            <SectionHead title="Birthday car wash" />
            {used ? (
              <p className="capp-pass-line">This year&apos;s birthday car wash is already used.</p>
            ) : ready && birthday.perk.code ? (
              <p className="capp-pass-line">
                Your code is <strong>{birthday.perk.code}</strong>. It lasts 7 days. Show it at the branch. One use this year.
              </p>
            ) : ready ? (
              <p className="capp-pass-line">Your free car wash is ready. Show this at any branch.</p>
            ) : isToday ? (
              <p className="capp-pass-line">Today is your birthday. Claim one free car wash.</p>
            ) : birthday?.date_of_birth ? (
              <p className="capp-pass-line">The free car wash opens on your birthday.</p>
            ) : (
              <p className="capp-pass-line">
                Add your birthday in <Link to="/account/more?tab=account">Settings</Link> first.
              </p>
            )}
            <div className="capp-actions">
              <button
                type="button"
                className="capp-btn capp-btn-accent"
                disabled={!canClaim || busy === 'birthday'}
                onClick={claimBirthday}
              >
                {used ? 'Used this year' : 'Claim free car wash'}
              </button>
            </div>
          </section>

          <section className="capp-card" aria-label="Enter voucher code">
            <SectionHead title="Have a voucher code?" />
            <p className="capp-meta">Enter your promo code or discount voucher to verify it and use it on bookings.</p>
            <form onSubmit={checkVoucherCode} className="mt-3 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g. SUMMER10)"
                  className="min-h-11 flex-1 font-mono uppercase tracking-wider px-3.5 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Voucher code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={16}
                />
                <button
                  type="submit"
                  className="capp-btn capp-btn-accent min-h-11 font-semibold"
                  disabled={!voucherInput.trim() || busy === 'check-voucher'}
                >
                  {busy === 'check-voucher' ? 'Checking…' : 'Check code'}
                </button>
              </div>

              {voucherCheckError ? (
                <p className="text-xs font-medium text-destructive mt-1.5" role="alert">
                  {voucherCheckError}
                </p>
              ) : null}

              {verifiedVoucher ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={15} /> Active Voucher
                    </span>
                    <strong className="font-mono text-sm px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-900 dark:text-emerald-200">
                      {verifiedVoucher.code}
                    </strong>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {verifiedVoucher.title} · {verifiedVoucher.discount_kind === 'free' ? 'Free service' : (verifiedVoucher.discount_kind === 'fixed' || verifiedVoucher.discount_kind === 'amount') ? `₱${Math.round((verifiedVoucher.discount_amount_minor || 0) / 100).toLocaleString()} discount` : `${verifiedVoucher.discount_percent}% discount`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {verifiedVoucher.rules_text}
                  </p>
                  <div className="pt-1">
                    <Link
                      to={`/account/book?voucher=${verifiedVoucher.code}`}
                      className="capp-btn capp-btn-fill capp-btn-block text-xs font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      Use on next booking <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              ) : null}
            </form>
          </section>

          <section className="capp-card" aria-label="Promo vouchers">
            <SectionHead title="Promo vouchers" />
            <p className="capp-meta">Show the code to the Team Lead on the queue. The counter counts each use.</p>
            {promoActive.length ? (
              <div className="capp-group">
                {promoActive.map((row) => (
                  <div className="capp-row" key={row.id}>
                    <div>
                      <strong className="font-mono">{row.code}</strong>
                      <p className="capp-pass-line">{row.title}</p>
                      <p className="capp-meta">{row.rules_text || customerVoucherRulesLine(row)}</p>
                    </div>
                    <Link
                      to={`/account/book?voucher=${row.code}`}
                      className="capp-link text-xs font-semibold whitespace-nowrap self-center ml-auto flex items-center gap-1"
                    >
                      Book with this →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="capp-pass-line">No open promo codes right now.</p>
            )}
          </section>

          {promoHistory.length ? (
            <section className="capp-section" aria-label="Voucher history">
              <SectionHead title="Voucher history" />
              <div className="capp-group">
                {promoHistory.map((row) => (
                  <div className="capp-row" key={row.id}>
                    <div>
                      <strong>{row.promo_vouchers?.title || row.promo_vouchers?.code || 'Voucher'}</strong>
                      <p className="capp-meta">
                        {row.promo_vouchers?.code ? `${row.promo_vouchers.code} · ` : ''}
                        {row.bookings?.vehicle_plate || 'Ticket'}
                        {row.discount_minor ? ` · saved ${formatMoney(row.discount_minor)}` : ''}
                        {row.consumed_at ? ' · used' : ' · on a ticket'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="capp-section" aria-label="Points shop">
            <SectionHead title="Points shop" note={pointsLabel(points)} />
            {branches.length ? (
              <label className="capp-pass-line" htmlFor="voucher-pickup">
                Pickup branch
                <select
                  id="voucher-pickup"
                  className="capp-select"
                  value={pickup}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  {branches.map((row) => (
                    <option key={row.slug} value={row.slug}>{row.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="capp-empty">No branch is open for pickup.</p>
            )}
            {shop.length ? (
              <div className="capp-group">
                {shop.map((item) => {
                  const cost = Number(item.points_price) || 0
                  const onHand = branchOnHand(item.product_branch_stock, pickup)
                  const short = points < cost
                  const missing = onHand == null
                  const out = missing || onHand <= 0
                  const stockLine = missing ? 'Not at this branch' : out ? 'Out of stock' : pointsLabel(cost)
                  return (
                    <div className="capp-row" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <p className="capp-meta">{stockLine}</p>
                      </div>
                      <button
                        type="button"
                        className="capp-btn capp-btn-fill"
                        style={{ marginLeft: 'auto' }}
                        disabled={!pickup || short || out || busy === item.id}
                        onClick={() => redeem(item)}
                      >
                        {missing ? 'Not here' : out ? 'Out of stock' : short ? 'Need points' : 'Use points'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="capp-empty">Nothing is in the shop yet.</p>
            )}
          </section>

          {redemptions.length ? (
            <section className="capp-section" aria-label="Your redemptions">
              <SectionHead title="Ready for pickup" />
              <div className="capp-group">
                {redemptions.map((row) => (
                  <div className="capp-row" key={row.id}>
                    <div>
                      <strong>{row.products?.name || 'Accessory'}</strong>
                      <p className="capp-meta">{pointsLabel(row.points_spent)}. {row.status === 'fulfilled' ? 'Picked up' : `Show this at ${branches.find((b) => b.slug === row.branch_slug)?.name || 'the branch'}`}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </CustomerAppFrame>
  )
}
