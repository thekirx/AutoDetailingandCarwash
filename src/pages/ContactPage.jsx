import { Link } from 'react-router-dom'
import { ArrowUpRight, Facebook, Instagram, Mail, MapPin, MessageSquareWarning, Phone } from 'lucide-react'
import { usePublicBranches } from '@/lib/branches'
import BdPageHero from '../components/public/bredesign/BdPageHero'

const channels = [
  {
    key: 'phone',
    icon: Phone,
    label: 'Call or text',
    value: '0915 629 6096',
    hint: 'Fastest way to reach the floor team',
    href: 'tel:+639156296096',
  },
  {
    key: 'sales',
    icon: Mail,
    label: 'Sales and bookings',
    value: 'sales@hakumautocare.com',
    hint: 'Quotes, packages, and schedule questions',
    href: 'mailto:sales@hakumautocare.com',
  },
  {
    key: 'admin',
    icon: Mail,
    label: 'Admin and billing',
    value: 'admin@hakumautocare.com',
    hint: 'Invoices, records, and brand collaborations',
    href: 'mailto:admin@hakumautocare.com',
  },
]

const socials = [
  {
    key: 'facebook',
    icon: Facebook,
    label: 'Facebook',
    handle: 'Hakum Auto Care',
    href: 'https://www.facebook.com/share/1GHerg8pxV/',
  },
  {
    key: 'instagram',
    icon: Instagram,
    label: 'Instagram',
    handle: '@_hakumautocare',
    href: 'https://www.instagram.com/_hakumautocare',
  },
]

export default function ContactPage() {
  const { branches } = usePublicBranches({ mode: 'visible' })

  return (
    <>
      <BdPageHero
        eyebrow="Talk to Hakum"
        title={
          <>
            Contact
            <br />
            <em>us.</em>
          </>
        }
        copy="Questions about services, bookings, or branches — call, message, or email us directly and the team will pick it up."
      />
      <section className="contact-page">

      <div className="public-shell contact-channels">
        {channels.map(({ key, icon: Icon, label, value, hint, href }) => (
          <a className="contact-card" key={key} href={href}>
            <span className="contact-card-icon" aria-hidden>
              <Icon />
            </span>
            <p className="contact-card-label">{label}</p>
            <strong className="contact-card-value">{value}</strong>
            <span className="contact-card-hint">{hint}</span>
          </a>
        ))}
        <Link className="contact-card contact-card-alt" to="/complaints">
          <span className="contact-card-icon" aria-hidden>
            <MessageSquareWarning />
          </span>
          <p className="contact-card-label">Something went wrong?</p>
          <strong className="contact-card-value">Submit a complaint</strong>
          <span className="contact-card-hint">Goes straight to branch management</span>
        </Link>
      </div>

      <div className="public-shell contact-split">
        <div className="contact-block">
          <h2 className="contact-block-title">Visit a branch</h2>
          <div className="contact-branches">
            {branches.map((b) => (
              <Link
                className="contact-branch"
                key={b.slug}
                to={b.coming_soon ? '/branches' : `/queue/${b.slug}`}
              >
                <span className="contact-branch-icon" aria-hidden>
                  <MapPin />
                </span>
                <span className="contact-branch-copy">
                  <strong>{b.name.replace(/^Hakum Auto Care\s*/i, '') || b.name}</strong>
                  <small>{b.coming_soon ? 'Coming soon' : (b.address || 'Open daily')}</small>
                </span>
                <ArrowUpRight aria-hidden />
              </Link>
            ))}
            {!branches.length ? (
              <Link className="contact-branch" to="/branches">
                <span className="contact-branch-icon" aria-hidden>
                  <MapPin />
                </span>
                <span className="contact-branch-copy">
                  <strong>Find a branch</strong>
                  <small>Locations across the Philippines</small>
                </span>
                <ArrowUpRight aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="contact-block">
          <h2 className="contact-block-title">Follow the work</h2>
          <div className="contact-socials">
            {socials.map(({ key, icon: Icon, label, handle, href }) => (
              <a className="contact-social" key={key} href={href} target="_blank" rel="noreferrer">
                <span className="contact-social-icon" aria-hidden>
                  <Icon />
                </span>
                <span className="contact-branch-copy">
                  <strong>{label}</strong>
                  <small>{handle}</small>
                </span>
                <ArrowUpRight aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
