import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import BdPageHero from '@/components/public/bredesign/BdPageHero'
import ServiceFaqSection from '@/components/public/bredesign/ServiceFaqSection'
import { CUSTOMER_LOYALTY_PATH } from '@/lib/customerAccountNav'
import { usePageMeta } from '@/lib/pageMeta'
import { validityPhrase } from '@/lib/referral'
import { useReferralSettings } from '@/lib/useReferralSettings'
import './ReferPage.css'

/**
 * /refer — approved 2026-10-17 (design-mocks/birthday-profile-referral-2026-10-17 board 03).
 * Detailing and up only, never carwash. Every number and reward word comes from
 * the referral settings. Until the program is switched on the page is unlinked
 * and noindex (D5 option c), so the client can review it on the test link.
 */
function joinList(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
}

export default function ReferPage() {
  const { settings } = useReferralSettings()
  const { profile } = useAuth()
  const isCustomer = profile?.role === 'customer'
  const linkTo = isCustomer ? `${CUSTOMER_LOYALTY_PATH}#refer` : '/signin'
  const reward = settings.reward_label
  const validity = validityPhrase(settings.validity_days)
  const counting = joinList(settings.eligible_services)
  const notCounting = joinList(settings.excluded_services)

  usePageMeta({
    title: 'Refer a friend',
    description: 'Share your Hakum link. When your friend gets their first detailing service or higher, you both get a reward.',
    path: '/refer',
    noindex: !settings.enabled,
  })

  const faqs = [
    {
      question: 'Does a carwash count?',
      answer: `No. Only detailing and up counts: ${counting}. ${notCounting} don’t count, and the reward can’t be used on them.`,
    },
    {
      question: 'Does my friend need the app?',
      answer: 'They need a Hakum account, which takes a minute from your link. After that they can use the app or the website.',
    },
    {
      question: 'When does the reward show up?',
      answer: `Right after your friend’s first paid detailing service or higher goes through at the counter. You both see it in Rewards, and it’s good for ${validity}.`,
    },
    {
      question: 'Which branches honour it?',
      answer: 'Every Hakum branch. Show the reward in Rewards at the counter.',
    },
    {
      question: 'Can I refer someone who already has an account?',
      answer: 'No. The program is for new Hakum customers, one account per phone number.',
    },
  ]

  return (
    <div className="refer-page">
      <BdPageHero
        eyebrow="Refer a friend"
        title={
          <>
            Bring a friend. <em>You both</em> get pampered.
          </>
        }
        copy={`Share your Hakum link. When your friend gets their first detailing service or higher, you each get a ${reward.toLowerCase()}.`}
      >
        <div className="bd-page-hero-links refer-hero-links">
          <Link className="bd-btn bd-btn-light" to={linkTo}>
            Get my link <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <a className="bd-btn bd-btn-quiet" href="#how-it-works">
            How it works
          </a>
        </div>
        <dl className="refer-give" aria-label="What you both get">
          <div>
            <dt>You</dt>
            <dd>{reward}</dd>
          </div>
          <div>
            <dt>Your friend</dt>
            <dd>{reward}</dd>
          </div>
          <div>
            <dt>Counts on</dt>
            <dd className="is-plain">Detailing &amp; up — not carwash</dd>
          </div>
          <div>
            <dt>Use within</dt>
            <dd className="is-plain">{validity}</dd>
          </div>
          <div>
            <dt>Limit</dt>
            <dd className="is-plain">Up to {settings.yearly_cap} friends a year</dd>
          </div>
        </dl>
      </BdPageHero>

      <section className="refer-steps" id="how-it-works" aria-labelledby="refer-steps-title">
        <div className="bd-shell">
          <p className="bd-eyebrow">How it works</p>
          <h2 id="refer-steps-title">
            Three <em>steps.</em>
          </h2>
          <ol>
            <li>
              <span aria-hidden="true">01</span>
              <h3>Share your link</h3>
              <p>Sign in and copy your link, or send it straight to Messenger, Viber or SMS.</p>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <h3>Friend signs up</h3>
              <p>They open the link and create a Hakum account with their phone and plate.</p>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <h3>Both get the treat</h3>
              <p>After their first paid detailing service or higher, a reward lands in both of your Rewards.</p>
            </li>
          </ol>
        </div>
      </section>

      <ServiceFaqSection serviceId="refer" serviceName="Refer a friend" faqs={faqs} />

      <section className="refer-terms" aria-labelledby="refer-terms-title">
        <div className="bd-shell">
          <p className="bd-eyebrow">The fine print</p>
          <h2 id="refer-terms-title">
            Fair <em>rules.</em>
          </h2>
          <ul>
            <li>New Hakum customers only — one account per phone number.</li>
            <li>
              The reward unlocks after your friend’s first <strong>paid detailing service or higher</strong> at any branch: {counting}.
            </li>
            <li>
              <strong>{notCounting} don’t count</strong>, and the reward can’t be used on them.
            </li>
            <li>A refunded or voided sale doesn’t count.</li>
            <li>Rewards are good for {validity} after they unlock and can’t be exchanged for cash.</li>
            <li>Up to {settings.yearly_cap} friends a year. Hakum may cancel rewards from fake or duplicate accounts.</li>
          </ul>
        </div>
      </section>

      <section className="bd-service-bottom-cta">
        <div className="bd-shell">
          <p className="bd-eyebrow">Share the good stuff</p>
          <h2>
            Pamper it. <em>Share it.</em>
          </h2>
          <p>Your link is waiting in Rewards.</p>
          <Link className="bd-btn bd-btn-primary" to={linkTo}>
            Get my link <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  )
}
