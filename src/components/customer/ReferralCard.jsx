import { useState } from 'react'
import { Check, Copy, Gift, Hourglass, MessageCircle, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { referralStatusLine, validityPhrase } from '@/lib/referral'
import { formatPerkDate } from '@/lib/birthdayPerk'

/**
 * Rewards tab: the customer's own link, share buttons, friends and rewards.
 * Approved 2026-10-17 (mock board 03). Detailing and up only, never carwash.
 * Renders nothing while the program is off (`referral` is null).
 */
export default function ReferralCard({ referral }) {
  const [copied, setCopied] = useState(false)
  if (!referral?.enabled || !referral.code) return null

  const link = referral.link
  const message = `Join me at Hakum Auto Care. Sign up with my link and we both get a ${String(referral.reward_label).toLowerCase()} after your first detailing service: ${link}`
  const used = Math.min(Number(referral.used_this_year) || 0, Number(referral.yearly_cap) || 0)
  const cap = Number(referral.yearly_cap) || 0
  const rewards = (referral.rewards || []).filter((w) => w.status === 'available')

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Link copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — press and hold the link instead.')
    }
  }

  // Messenger/Viber deep links only open on phones; on a computer, copy instead.
  function phoneOnly(e) {
    if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      e.preventDefault()
      copy()
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Hakum Auto Care', text: message, url: link })
        return
      } catch {
        /* closed the sheet */
        return
      }
    }
    copy()
  }

  return (
    <>
      {rewards.map((w) => (
        <section key={w.id} className="capp-ref-reward" aria-label="Refer-a-friend reward">
          <span className="capp-row-icon" aria-hidden>
            <Gift size={18} strokeWidth={1.75} />
          </span>
          <span className="capp-ref-reward-copy">
            <strong>{referral.reward_label}</strong>
            <small>Detailing &amp; up only, not carwash · use by {formatPerkDate(w.expires_at)}</small>
          </span>
        </section>
      ))}

      <section className="capp-card capp-ref" id="refer" aria-label="Refer a friend">
        <p className="capp-eyebrow">Refer a friend</p>
        <h2 className="capp-title">You both get a {String(referral.reward_label).toLowerCase()}.</h2>
        <p className="capp-meta">
          When a friend gets their first detailing service or higher. Carwash doesn&apos;t count. Rewards last{' '}
          {validityPhrase(referral.validity_days)}.
        </p>
        <button type="button" className="capp-ref-code" onClick={copy} aria-label={`Copy your link ${link}`}>
          <b>{referral.code}</b>
          <span>
            {copied ? <Check size={14} strokeWidth={2.4} aria-hidden /> : <Copy size={14} strokeWidth={2} aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </span>
        </button>
        <div className="capp-ref-share">
          <a href={`fb-messenger://share?link=${encodeURIComponent(link)}`} onClick={phoneOnly}>
            <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
            Messenger
          </a>
          <a href={`viber://forward?text=${encodeURIComponent(message)}`} onClick={phoneOnly}>
            <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
            Viber
          </a>
          <button type="button" onClick={share}>
            <Share2 size={18} strokeWidth={1.75} aria-hidden />
            More
          </button>
        </div>
        {cap ? (
          <>
            <p className="capp-meta capp-ref-count">
              {used} of {cap} friends joined this year
            </p>
            <div className="capp-ref-ladder" aria-hidden>
              {Array.from({ length: cap }, (_, i) => (
                <i key={i} className={i < used ? 'is-on' : ''}>
                  {i < used ? <Check size={12} strokeWidth={3} /> : i + 1}
                </i>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {(referral.referrals || []).length ? (
        <ul className="capp-ref-friends" aria-label="Friends you referred">
          {referral.referrals.map((row) => (
            <li key={row.id}>
              <span className="capp-row-icon" aria-hidden>
                {row.status === 'qualified' ? <Gift size={18} strokeWidth={1.75} /> : <Hourglass size={18} strokeWidth={1.75} />}
              </span>
              <span className="capp-ref-reward-copy">
                <strong>
                  {row.first_name} {row.status === 'qualified' ? 'got detailing' : 'signed up'}
                </strong>
                <small>{referralStatusLine(row)}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
