import { Link } from 'react-router-dom'
import { usePageMeta } from '@/lib/pageMeta'
import { openCookieConsentPrompt } from '@/lib/cookieConsent'
import { PUBLIC_ROUTE_SEO } from '@/lib/publicSeoCatalog'
import BdPageHero from '../components/public/bredesign/BdPageHero'

function LegalShell({ eyebrow, title, updated, path, description, toc = [], children }) {
  usePageMeta({ title, description, path })

  const peers = [
    { to: '/terms', label: 'Terms of Service' },
    { to: '/privacy', label: 'Privacy Policy' },
    { to: '/cookies', label: 'Cookie Policy' },
  ].filter((p) => p.to !== path)

  return (
    <>
      <BdPageHero eyebrow={eyebrow} title={title} copy={`Last updated ${updated}`} />
      <section className="legal-page">
        <div className="public-shell legal-inner">
          <div className="legal-body">
            {toc.length > 0 && (
              <nav className="legal-toc" aria-label="On this page">
                <span className="legal-toc-label">Jump to section</span>
                {toc.map((item) => (
                  <a key={item.id} href={`#${item.id}`}>
                    {item.label}
                  </a>
                ))}
              </nav>
            )}
            {children}
          </div>
          <p className="legal-back">
            <Link to="/">Back to home</Link>
            {' · '}
            <Link to="/contact">Contact us</Link>
            {peers.map((p) => (
              <span key={p.to}>
                {' · '}
                <Link to={p.to}>{p.label}</Link>
              </span>
            ))}
          </p>
        </div>
      </section>
    </>
  )
}

const TERMS_TOC = [
  { id: 'eligibility', label: '1. Accounts & Eligibility' },
  { id: 'bookings-queue', label: '2. Bookings & Live Queue' },
  { id: 'pricing-payments', label: '3. Pricing & Payments' },
  { id: 'warranties-maintenance', label: '4. PPF Warranty & Ceramic Maintenance' },
  { id: 'loyalty-shop', label: '5. Loyalty, Vouchers & Aftercare Shop' },
  { id: 'notifications-media', label: '6. SMS, Web Push & Studio Media' },
  { id: 'acceptable-use', label: '7. Acceptable Use & Liability' },
  { id: 'governing-law', label: '8. Governing Law & Contact' },
]

export function TermsPage() {
  const seo = PUBLIC_ROUTE_SEO['/terms']
  return (
    <LegalShell
      eyebrow="Legal"
      title={seo.title}
      updated="November 21, 2026"
      path="/terms"
      description={seo.description}
      toc={TERMS_TOC}
    >
      <p className="legal-lede">
        These Terms of Service (&quot;Terms&quot;) form a binding agreement between you and Hakum Auto Care
        (&quot;Hakum&quot;, &quot;we&quot;, &quot;us&quot;) governing your use of hakumautocare.com, our customer portal,
        online bookings, live queue tools, loyalty and voucher programs, aftercare purchases, and studio services across
        our Philippine branches in Bacoor, Cavite and Batangas City. By creating an account, booking a bay, or receiving
        service, you agree to these Terms.
      </p>

      <h2 id="eligibility">1. Accounts, vehicle verification, and eligibility</h2>
      <p>
        You must be able to form a binding contract under Philippine law. Customer portal accounts are for personal,
        non-commercial tracking of your vehicles, protection warranties, maintenance schedules, and loyalty stamps or
        points. Staff, advisor, and admin accounts are provisioned exclusively by authorized Hakum Super Admins. You agree
        to provide accurate mobile and vehicle plate details and to safeguard your password and sign-in session.
      </p>

      <h2 id="bookings-queue">2. Services, bay bookings, and live queue</h2>
      <p>
        Online booking slots, detailing duration guides, and <Link to="/queue">Live Queue</Link> bay counters are real-time
        operational estimates based on current studio throughput. Actual start and release times may shift due to walk-in
        volume, heavy rain or curing humidity, pre-existing paint oxidation or clear-coat condition, and curing hold times.
        Hakum may reschedule or decline work where unsafe electrical, structural, or compromised paint conditions are found
        during intake inspection. Please remove all valuables, toll cards, and loose items prior to bay check-in.
      </p>

      <h2 id="pricing-payments">3. Pricing, assessments, and payments</h2>
      <p>
        Online pricing menus and package cards represent standard starting tiers by vehicle size class (Small, Medium,
        Large, Extra Large). Final job quotations—especially for multi-stage paint correction, heavy acid-rain glass removal,
        or third-party coating condition assessments—are confirmed in person at bay intake before work commences. Payment is
        due upon vehicle release as recorded at POS. Any workmanship concerns must be raised with the Bay Lead or Branch
        Advisor prior to exiting the studio whenever reasonably possible so we can inspect and remedy promptly.
      </p>

      <h2 id="warranties-maintenance">4. ClearPro PPF warranty &amp; Kisho 9H ceramic maintenance</h2>
      <ul>
        <li>
          <strong>ClearPro TPU Paint Protection Film (PPF):</strong> Eligible ClearPro installations carry up to a
          10-year limited warranty against manufacturing yellowing, cracking, peeling, and bubbling when cared for under
          studio guidelines. Avoid high-pressure nozzles aimed directly at wrapped panel edges, abrasive polishes, or
          harsh degreasers.
        </li>
        <li>
          <strong>Kisho 9H Ceramic Coating &amp; Unlimited Recoating:</strong> Hakum ceramic packages include automated
          6-month Paint Maintenance tracking in your customer portal. Unlimited Recoating privileges on eligible tiers
          require completing scheduled 6-month maintenance inspections and refraining from harsh automatic brush washes
          or non-pH-neutral roadside detergents.
        </li>
        <li>
          <strong>Third-Party Coating Assessments:</strong> Vehicles previously coated elsewhere are inspected with gloss
          and hydrophobic contact checks before enrolling in a Hakum maintenance or recoating cycle.
        </li>
      </ul>

      <h2 id="loyalty-shop">5. Loyalty points, vouchers, and Aftercare Shop reservations</h2>
      <p>
        Wash stamps, milestone rewards, Points Shop items, and promo vouchers follow the validity dates, branch rules, and
        single-visit redemption conditions displayed in your <Link to="/account/loyalty">Customer Loyalty</Link> view.
        Vouchers and points carry no cash value and are non-transferable unless expressly enabled for referral rewards.{' '}
        <Link to="/shop">Aftercare Shop</Link> reservations are fulfilled for branch pickup in Bacoor or Batangas City or
        dispatched via arranged courier once staff confirm physical branch stock.
      </p>

      <h2 id="notifications-media">6. SMS alerts, Web Push updates, and studio photography</h2>
      <p>
        By booking online or maintaining a vehicle record with a verified mobile number or browser push opt-in, you
        authorize Hakum to send transactional queue turn alerts, booking confirmations, ceramic maintenance reminders, and
        account security notices via BusyBee SMS or Web Push. You may opt out of promotional broadcasts or revoke browser
        push permission at any time in your browser settings or account preferences. Our bays may capture inspection and
        showcase photos of vehicles without exposing customer personal contact details; contact a Branch Advisor before
        intake if you prefer no public showcase use of your vehicle photos.
      </p>

      <h2 id="acceptable-use">7. Acceptable use, IP, disclaimers, and indemnity</h2>
      <p>
        You may not attempt unauthorized access to customer or staff endpoints, scrape customer or fleet records, interfere
        with queue displays, submit fraudulent bookings or complaints, or misuse <Link to="/tint-finder">Tint Finder</Link>{' '}
        or API routes. All Hakum marks, copy, photography, and 3D previews remain the property of Hakum Auto Care.
        To the fullest extent permitted under Philippine law, Hakum is not liable for indirect or consequential damages from
        website downtime or queue wait shifts, and nothing in these Terms excludes non-waivable consumer protections. You
        agree to indemnify Hakum against claims arising from false disclosures or misuse of the site.
      </p>

      <h2 id="governing-law">8. Governing law, changes, and contact</h2>
      <p>
        These Terms are governed by the laws of the Republic of the Philippines, with venue in the proper courts of
        Bacoor, Cavite or Batangas City as applicable. We may update these Terms prospectively by posting a new effective
        date here. For questions or formal notices, reach{' '}
        <a href="mailto:admin@hakumautocare.com">admin@hakumautocare.com</a>, call{' '}
        <a href="tel:+639156296096">0915 629 6096</a>, or use our <Link to="/contact">Contact</Link> page.
      </p>
      <p className="legal-note">
        Operational summary for transparency: formal commercial fleet contracts or distribution agreements may incorporate
        signed master service addenda between Hakum Auto Care and partner businesses.
      </p>
    </LegalShell>
  )
}

const PRIVACY_TOC = [
  { id: 'data-collected', label: '1. Data We Collect' },
  { id: 'purposes', label: '2. Why We Process It' },
  { id: 'processors', label: '3. Processors & SMS/Push' },
  { id: 'security-retention', label: '4. Security & Zero-Leak Access' },
  { id: 'rights', label: '5. Your RA 10173 Rights' },
  { id: 'contact', label: '6. Privacy Contact' },
]

export function PrivacyPage() {
  const seo = PUBLIC_ROUTE_SEO['/privacy']
  return (
    <LegalShell
      eyebrow="Legal"
      title={seo.title}
      updated="November 21, 2026"
      path="/privacy"
      description={seo.description}
      toc={PRIVACY_TOC}
    >
      <p className="legal-lede">
        Hakum Auto Care (&quot;Hakum&quot;, &quot;we&quot;) protects your personal information in accordance with the
        Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and National Privacy Commission (NPC) guidelines.
        This Policy explains what information we collect across our studios and web application, how it is protected, and
        how you control your records.
      </p>

      <h2 id="data-collected">1. Personal data we collect</h2>
      <ul>
        <li>
          <strong>Identity &amp; contact:</strong> name, Philippine mobile number, optional login email address, date of
          birth (only if optionally added on your signed-in profile), and encrypted sign-in credentials.
        </li>
        <li>
          <strong>Vehicle &amp; service records:</strong> plate number, vehicle make/model/color/size tier, selected studio
          branch, walk-in queue entries, booking notes, inspection checklists, POS receipts, and warranty or ceramic
          maintenance cycles.
        </li>
        <li>
          <strong>Notification &amp; support records:</strong> Web Push subscription endpoints (`push_subscriptions`), SMS
          delivery logs for queue/booking alerts, and messages sent through <Link to="/contact">Contact</Link>,{' '}
          <Link to="/partnerships">Partnerships</Link>, or <Link to="/complaints">Complaints</Link>.
        </li>
        <li>
          <strong>Technical &amp; session data:</strong> strictly necessary session tokens and local preference storage.
        </li>
      </ul>

      <h2 id="purposes">2. Legal bases and operational purposes</h2>
      <ul>
        <li>
          <strong>Service delivery &amp; warranty fulfillment (Contract):</strong> scheduling detailing bays, operating live
          walk-in queues, honoring ClearPro PPF warranties and Kisho 9H 6-month maintenance, and tracking loyalty points.
        </li>
        <li>
          <strong>Transactional queue &amp; service notifications (Contract / Consent):</strong> sending SMS queue turn alerts,
          vehicle-ready updates, password setup links, and consented Web Push reminders.
        </li>
        <li>
          <strong>Security, audit &amp; statutory compliance (Legal Obligation / Legitimate Interest):</strong> preventing
          unauthorized account probing, preserving tax/sales receipts, and defending studio claims.
        </li>
      </ul>

      <h2 id="processors">3. Trusted infrastructure processors and no data selling</h2>
      <p>
        We do not sell or rent customer data to advertisers or data brokers. We process data strictly through verified
        infrastructure providers required to run Hakum Auto Care—specifically Supabase (database &amp; authentication), Vercel
        (application hosting), and BusyBee SMS (transactional mobile alerts)—under access-controlled credentials.
        Vehicle plate lookup on public booking screens returns non-personal vehicle classification metadata (make, model,
        size, color) only, and public sign-in lookup endpoints never expose customer names, phone numbers, dates of birth,
        or email addresses prior to authentication.
      </p>

      <h2 id="security-retention">4. Access controls, retention, and security</h2>
      <p>
        Customer records are protected with Supabase Row-Level Security (RLS), role-restricted staff APIs, and explicit
        database permission grants separating public pages from staff and financial tables. Service and receipt history is
        retained while your customer relationship or ClearPro PPF warranty remains active and for statutory Philippine
        tax/accounting retention windows thereafter, then deleted or anonymized. Report any suspected security issue
        immediately to <a href="mailto:admin@hakumautocare.com">admin@hakumautocare.com</a>.
      </p>

      <h2 id="rights">5. Your rights under RA 10173 &amp; cookies</h2>
      <p>
        Under the Data Privacy Act of 2012, you have the right to be informed, access your personal data, request
        correction of inaccurate vehicle or contact details, object to non-essential messaging, or request deletion/blocking
        once open visits and statutory holds clear. For cookie settings and local storage rules, read our{' '}
        <Link to="/cookies">Cookie Policy</Link>. You also have the right to elevate unresolved complaints to the Philippine
        National Privacy Commission (NPC).
      </p>

      <h2 id="contact">6. Children &amp; privacy contact</h2>
      <p>
        Our platform is intended for vehicle owners and licensed drivers; we do not knowingly create accounts for anyone
        under 13. Privacy requests:{' '}
        <a href="mailto:admin@hakumautocare.com">admin@hakumautocare.com</a> ·{' '}
        <a href="tel:+639156296096">0915 629 6096</a> · <Link to="/branches">Branch Directory</Link>.
      </p>
      <p className="legal-note">
        Infrastructure providers may operate servers outside the Philippines with encryption in transit and at rest.
        Using hakumautocare.com signifies acknowledgment of these technical transfers solely for service delivery.
      </p>
    </LegalShell>
  )
}

const COOKIES_TOC = [
  { id: 'what', label: '1. Cookies & Browser Storage' },
  { id: 'essential', label: '2. Essential Auth & PWA Cache' },
  { id: 'optional', label: '3. Optional Measurement' },
  { id: 'manage', label: '4. Manage Choices' },
]

export function CookiesPage() {
  const seo = PUBLIC_ROUTE_SEO['/cookies']
  return (
    <LegalShell
      eyebrow="Legal"
      title={seo.title}
      updated="November 21, 2026"
      path="/cookies"
      description={seo.description}
      toc={COOKIES_TOC}
    >
      <p className="legal-lede">
        This Cookie Policy explains how Hakum Auto Care (&quot;Hakum&quot;, &quot;we&quot;) uses essential browser
        cookies, localStorage preferences, and Progressive Web App (PWA) service-worker storage on hakumautocare.com. It
        reads alongside our <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2 id="what">1. What cookies and browser storage we use</h2>
      <p>
        Cookies are small text tokens stored by your browser. Modern web apps like the Hakum Customer Portal also use
        browser `localStorage`, `sessionStorage`, and Cache Storage (for installable PWA performance) to keep your session
        secure and fast without repeatedly re-downloading static assets.
      </p>

      <h2 id="essential">2. Strictly necessary storage &amp; PWA service worker</h2>
      <ul>
        <li>
          <strong>Customer &amp; staff authentication:</strong> keeps your signed-in Supabase session token active across
          customer portal pages (`/account/*`), loyalty passes, and queue tracking.
        </li>
        <li>
          <strong>Security &amp; form protection:</strong> safeguards booking intake, public inquiry submission, and sign-in
          rate limits from automated abuse.
        </li>
        <li>
          <strong>Preferences &amp; Web Push:</strong> remembers your cookie consent decision (`hakum_cookie_consent`) and,
          when you explicitly click Allow on notifications, registers the browser service worker endpoint for service alerts.
        </li>
      </ul>
      <p>Essential storage is required for sign-in and booking flows and remains active when choosing &quot;Necessary only&quot;.</p>

      <h2 id="optional">3. Optional measurement cookies</h2>
      <p>
        When you choose &quot;Accept all&quot;, your browser records consent for optional measurement scripts if enabled in
        future releases. Hakum does not run third-party advertising trackers or sell browsing behavior across sites.
      </p>

      <h2 id="manage">4. Managing your preferences</h2>
      <p>
        You can change your choice anytime below or from the Cookie preferences link in the site footer, or clear site data
        directly in your browser settings. Questions? Email{' '}
        <a href="mailto:admin@hakumautocare.com">admin@hakumautocare.com</a> or visit <Link to="/contact">Contact</Link>.
      </p>
      <p>
        <button type="button" className="button button-blue" onClick={() => openCookieConsentPrompt()}>
          Update cookie preferences
        </button>
      </p>
    </LegalShell>
  )
}
