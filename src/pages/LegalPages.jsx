import { Link } from 'react-router-dom'
import { usePageMeta } from '@/lib/pageMeta'

function LegalShell({ eyebrow, title, updated, path, description, children }) {
  usePageMeta({ title, description, path })

  return (
    <section className="legal-page">
      <div className="public-shell legal-inner">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="section-title">{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        <div className="legal-body">{children}</div>
        <p className="legal-back">
          <Link to="/">Back to home</Link>
          {' · '}
          <Link to="/contact">Contact us</Link>
          {' · '}
          <Link to={path === '/terms' ? '/privacy' : '/terms'}>{path === '/terms' ? 'Privacy Policy' : 'Terms of Service'}</Link>
        </p>
      </div>
    </section>
  )
}

export function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terms of Service"
      updated="July 23, 2026"
      path="/terms"
      description="Terms of Service for Hakum Auto Care website, bookings, queue, and customer accounts."
    >
      <p className="legal-lede">
        These Terms of Service (&quot;Terms&quot;) form a binding agreement between you and Hakum Auto Care
        (&quot;Hakum&quot;, &quot;we&quot;, &quot;us&quot;) governing use of our websites, customer portal, booking and queue tools,
        loyalty features, and related services at our Philippine branches. By creating an account, booking,
        or using the site, you agree to these Terms.
      </p>

      <h2>1. Who may use Hakum</h2>
      <p>
        You must be able to form a binding contract under Philippine law. Customer accounts are for personal,
        non-commercial tracking of your vehicles and visits. Staff and admin accounts are issued only by Hakum Super Admin.
        You must provide accurate name and contact details and keep your password confidential.
      </p>

      <h2>2. Services, bookings, and live queue</h2>
      <p>
        Online booking slots, estimated times, and live queue displays are operational estimates based on current branch load.
        Actual start and finish times may change due to walk-ins, weather, vehicle condition, parts or product availability,
        and staffing. Hakum may refuse, pause, or reschedule service when needed for safety, capacity, or fraud prevention.
        You are responsible for removing valuables and disclosing known vehicle issues before service begins.
      </p>

      <h2>3. Pricing, payment, and receipts</h2>
      <p>
        Prices shown online are indicative unless confirmed in writing or at the branch counter. Final charges follow the
        service performed and any approved add-ons. Payment is due as stated at POS. Disputes about workmanship or charges
        should be raised before leaving the premises when reasonably possible.
      </p>

      <h2>4. Loyalty, memberships, and promotions</h2>
      <p>
        Stamps, milestones, membership tiers, and promos follow rules published in your account, at the branch, or in
        campaign materials. Hakum may change program rules prospectively with notice via the site or branch signage.
        Benefits have no cash value unless expressly stated.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        You may not misuse the site, attempt unauthorized access, scrape or harvest data, interfere with queue integrity,
        submit abusive or false complaints, or use another person&apos;s account without permission. We may suspend or
        terminate access for violations.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        Hakum names, logos, site content, and brand materials are owned by Hakum or its licensors. You may not copy or
        reuse them except as needed to use the services.
      </p>

      <h2>7. Disclaimers and limitation of liability</h2>
      <p>
        The site and queue tools are provided on an &quot;as available&quot; basis. To the fullest extent permitted by
        Philippine law, Hakum is not liable for indirect, incidental, or consequential damages arising from site use,
        queue delays, or missed appointments. For vehicle work, Hakum performs services with professional care; report
        damage concerns before leaving the branch so we can inspect and resolve.
      </p>

      <h2>8. Indemnity</h2>
      <p>
        You agree to indemnify Hakum against claims arising from your misuse of the site, false information you submit,
        or violation of these Terms, except to the extent caused by Hakum&apos;s gross negligence or willful misconduct.
      </p>

      <h2>9. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the Republic of the Philippines. Venue for disputes lies in the competent
        courts of Cavite or Batangas, as applicable to the branch involved, unless mandatory consumer rules provide otherwise.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these Terms by posting a new version with a revised &quot;Last updated&quot; date. Continued use after
        posting constitutes acceptance. Material account changes may also be highlighted at sign-in when practical.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:admin@hakumautocare.com">admin@hakumautocare.com</a>
        {' '}· phone <a href="tel:+639156296096">0915 629 6096</a>
        {' '}· <Link to="/contact">contact form</Link>.
      </p>
      <p className="legal-note">
        This document is provided for operational transparency. For regulated filings or special commercial contracts,
        Hakum may rely on counsel-reviewed addenda.
      </p>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Privacy Policy"
      updated="July 23, 2026"
      path="/privacy"
      description="Privacy Policy for Hakum Auto Care — how we collect, use, and protect customer data."
    >
      <p className="legal-lede">
        Hakum Auto Care (&quot;Hakum&quot;, &quot;we&quot;) respects your privacy. This Privacy Policy explains what personal
        data we collect, why we process it, how we share it, and the choices available to you under the Philippine Data
        Privacy Act of 2012 (RA 10173) and related rules, as applicable.
      </p>

      <h2>1. Personal data we collect</h2>
      <ul>
        <li><strong>Identity &amp; contact:</strong> name, phone, email (optional), account credentials.</li>
        <li><strong>Vehicle &amp; visit:</strong> plate number, make/model, branch, queue status, services, payments tied to your visits.</li>
        <li><strong>Communications:</strong> messages via contact or complaint forms, SMS transactional notices.</li>
        <li><strong>Technical:</strong> session cookies required for sign-in; optional analytics cookies if you accept them.</li>
      </ul>

      <h2>2. Purposes and legal bases</h2>
      <ul>
        <li>Provide bookings, live queue, loyalty, payments support, and customer account features (contract / legitimate interest).</li>
        <li>Send service status and account setup messages you request (contract / consent where required).</li>
        <li>Improve branch operations and site reliability (legitimate interest).</li>
        <li>Comply with accounting, tax, and legal obligations (legal obligation).</li>
      </ul>

      <h2>3. Cookies</h2>
      <p>
        <strong>Essential:</strong> keep you signed in and remember cookie preference.
        <strong> Optional:</strong> help us understand traffic if you choose &quot;Accept all&quot; on the cookie banner.
        You can choose &quot;Necessary only&quot; anytime by clearing site data and revisiting. See also our cookie banner on first visit.
      </p>

      <h2>4. Sharing and processors</h2>
      <p>
        We use trusted processors (hosting, database, authentication) to operate the platform. We do not sell personal data.
        We may disclose information when required by law, court order, or to protect Hakum, customers, or the public from harm or fraud.
      </p>

      <h2>5. Retention and security</h2>
      <p>
        We retain account and visit records as needed for service history, loyalty, disputes, and legal retention periods,
        then delete or anonymize when no longer required. Access is role-restricted. No transmission method is perfectly secure;
        report suspected incidents to <a href="mailto:admin@hakumautocare.com">admin@hakumautocare.com</a>.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Subject to law and verification, you may request access, correction, or deletion of personal data, or withdraw consent
        where processing is consent-based. Account deletion may be limited by open visits, unpaid balances, or legal holds.
        Contact us via email or the <Link to="/contact">contact form</Link>. You may also lodge a complaint with the National Privacy Commission.
      </p>

      <h2>7. Children</h2>
      <p>Our services are directed to vehicle owners and operators; we do not knowingly create accounts for children under 13.</p>

      <h2>8. International processing</h2>
      <p>
        Infrastructure providers may process data in other countries with appropriate safeguards. By using the site you
        acknowledge such transfers as needed to deliver the service.
      </p>

      <h2>9. Updates</h2>
      <p>We may revise this Policy; the &quot;Last updated&quot; date shows the current version. Material changes may be highlighted on the site.</p>

      <h2>10. Contact / privacy inquiries</h2>
      <p>
        <a href="mailto:admin@hakumautocare.com">admin@hakumautocare.com</a>
        {' '}· <a href="tel:+639156296096">0915 629 6096</a>
        {' '}· Bacoor and Batangas branches listed on <Link to="/branches">Branches</Link>.
      </p>
      <p className="legal-note">
        This Policy supports day-to-day operations. Formal NPC registrations or DPIAs, when required, are handled separately by Hakum management.
      </p>
    </LegalShell>
  )
}
