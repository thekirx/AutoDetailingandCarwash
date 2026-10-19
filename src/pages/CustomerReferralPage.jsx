import { useEffect, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { SectionHead, Skeleton } from '@/components/customer/CustomerUi'
import { fetchPortal } from '@/lib/customerPortalClient'
import { CUSTOMER_REFERRAL_PATH } from '@/lib/customerAccountNav'
import { referralOfferCopy } from '@/lib/referralProgram'
import { usePageMeta } from '@/lib/pageMeta'

/** /account/referral — the customer's own code, copy, and share. */
export default function CustomerReferralPage() {
  usePageMeta({
    title: 'Your referral code',
    description: 'Share your Hakum code. A friend who books detailing earns points, and you get a detailing discount.',
    path: CUSTOMER_REFERRAL_PATH,
  })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchPortal().then(setData).catch((err) => setError(err.message))
  }, [])

  const code = data?.rewards?.referral_code || data?.profile?.referral_code || ''
  const credits = Number(data?.rewards?.available_discounts) || 0
  const shareText = code
    ? `Book detailing at Hakum with my code ${code}.`
    : ''

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Code copied')
    } catch {
      toast.error('Copy did not work. Select the code and copy it.')
    }
  }

  async function shareCode() {
    if (!code) return
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Hakum referral', text: shareText })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    await copyCode()
  }

  return (
    <CustomerAppFrame title="Your code" subtitle="Friends enter this when they book detailing." cols>
      {error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>{error}</strong>
        </div>
      ) : null}
      {!data && !error ? (
        <div className="capp-span">
          <Skeleton n={2} />
        </div>
      ) : null}
      {data ? (
        <section className="capp-card capp-span" aria-label="Referral code">
          <SectionHead title="Share your code" />
          <p className="capp-count" style={{ letterSpacing: '0.08em' }}>{code || 'Code unavailable'}</p>
          <p className="capp-pass-line">{referralOfferCopy(data.rewards?.program)}</p>
          <p className="capp-meta">
            {credits === 1 ? '1 detailing discount is waiting.' : `${credits} detailing discounts are waiting.`}
          </p>
          <div className="capp-actions">
            <button type="button" className="capp-btn capp-btn-fill" onClick={copyCode} disabled={!code}>
              {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
              {copied ? 'Copied' : 'Copy code'}
            </button>
            <button type="button" className="capp-btn capp-btn-ghost" onClick={shareCode} disabled={!code}>
              <Share2 size={18} aria-hidden />
              Share
            </button>
          </div>
        </section>
      ) : null}
    </CustomerAppFrame>
  )
}
