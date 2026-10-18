import { ArrowUpRight, Facebook, Instagram, Mail, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CookiePreferencesButton } from '@/components/CookieConsent'
import TikTokIcon from '@/components/public/TikTokIcon'
import { branchCityName } from '@/lib/branches'
import useMarquee from '@/components/public/bredesign/useMarquee'
import { useReferralSettings } from '@/lib/useReferralSettings'
import polishWide from '@/assets/footer/hakum-polish-1600.webp'
import polishNarrow from '@/assets/footer/hakum-polish-800.webp'
import certIatf from '@/assets/partners/cert-iatf-16949.webp'
import certIso from '@/assets/partners/cert-iso-9001.webp'
import certSgs from '@/assets/partners/cert-sgs-qualicert.webp'
import clearproLogo from '@/assets/partners/clearpro-white.webp'
import hakumMark from '@/assets/partners/hakum-mark.webp'
import hakumLockup from '@/assets/partners/hakum-lockup.webp'
import hakumWordmark from '@/assets/partners/hakum-wm.webp'
import skinCancerSeal from '@/assets/partners/skin-cancer-seal.webp'
import './SiteFooter.css'

/**
 * Site-wide footer ("Framed photo", approved 2026-10-12): a real Hakum photo as
 * a card carrying the sign-off and a moving strip of our marks, then branches
 * and contact.
 * It replaces the homepage's own "Book your car in" band.
 */
// Alternating: one of our marks, then a certification, and so on. Every mark is
// white on transparent so the strip reads as one set over the photo.
const MARKS = [
  { key: 'wordmark', name: 'Hakum Auto Detailing', src: hakumWordmark, width: 737, height: 120 },
  { key: 'cert', name: 'The Skin Cancer Foundation Seal of Recommendation', src: skinCancerSeal, width: 240, height: 442 },
  { key: 'symbol', name: 'Hakum', src: hakumMark, width: 253, height: 120 },
  { key: 'cert', name: 'SGS Qualicert service certification', src: certSgs, width: 318, height: 360 },
  { key: 'cleancars', name: 'Clean Cars' },
  { key: 'cert', name: 'ISO 9001:2015', src: certIso, width: 360, height: 360 },
  { key: 'clearpro', name: 'ClearPro', src: clearproLogo, width: 872, height: 120 },
  { key: 'cert', name: 'IATF 16949:2016 certified company', src: certIatf, width: 360, height: 360 },
]

export default function SiteFooter({ branches = [] }) {
  const { viewportRef, trackRef } = useMarquee()
  const { settings: referral } = useReferralSettings()

  return (
    <footer className="site-footer">
      <div className="sf-shell sf-card-wrap">
        <div className="sf-card">
          <img
            className="sf-photo"
            src={polishWide}
            srcSet={`${polishNarrow} 800w, ${polishWide} 1600w`}
            sizes="(max-width: 640px) 100vw, 1240px"
            alt=""
            width="1600"
            height="900"
            loading="lazy"
            decoding="async"
          />
          <div className="sf-card-copy">
            <h2 className="sf-title">
              Pamper it.
              <br />
              Protect it.
            </h2>
            <p className="sf-lede">Precision car care, premium protection, and genuine pride in every detail.</p>
          </div>

          {/* The same moving strip as "What goes on your car", over the photo: two
              identical runs translated by half their width so the loop is seamless.
              It is aria-hidden; the names are listed once below for screen readers. */}
          <div className="sf-marquee" ref={viewportRef} aria-hidden="true">
            <div className="sf-marquee-track" ref={trackRef}>
              {[0, 1].map((copy) => (
                <div className="sf-marquee-run" key={copy}>
                  {MARKS.map((mark) => (
                    <div className={`sf-marquee-item is-${mark.key}`} key={`${copy}-${mark.name}`}>
                      {mark.src ? (
                        <img src={mark.src} alt="" width={mark.width} height={mark.height} draggable="false" />
                      ) : (
                        /* Typeset stand-in until the Clean Cars logo file arrives. */
                        <span className="sf-cleancars">
                          <span>Clean</span>
                          <span>Cars?</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="sf-sr-only">{MARKS.map((mark) => mark.name).join(', ')}.</p>
        </div>
      </div>

      <div className="sf-shell sf-info">
        <div className="sf-about">
          <Link className="sf-logo" to="/" aria-label="Hakum Auto Care home">
            <img src={hakumLockup} alt="" width="480" height="282" />
          </Link>
          <p>Detailing, coatings, PPF and tint, done by people who care how your car leaves.</p>
          <div className="sf-social">
            <a href="https://www.facebook.com/share/1GHerg8pxV/" aria-label="Hakum on Facebook">
              <Facebook aria-hidden="true" />
            </a>
            <a href="https://www.instagram.com/_hakumautocare" aria-label="Hakum on Instagram">
              <Instagram aria-hidden="true" />
            </a>
            <a href="https://www.tiktok.com/@hakum_autocare" aria-label="Hakum on TikTok" target="_blank" rel="noreferrer noopener">
              <TikTokIcon />
            </a>
          </div>
        </div>

        <div className="sf-branches">
          <h3 className="sf-label">Branches</h3>
          {branches.length ? (
            branches.map((b) => (
              <Link key={b.slug} className={b.coming_soon ? 'is-soon' : ''} to={b.coming_soon ? '/branches' : `/queue/${b.slug}`}>
                <strong>{branchCityName(b)}</strong>
                <span>{b.coming_soon ? 'Opening soon' : b.address || 'Open daily'}</span>
                <em>
                  {b.coming_soon ? null : (
                    <>
                      <span className="sf-hide-sm">Live queue</span> <ArrowUpRight aria-hidden="true" />
                    </>
                  )}
                </em>
              </Link>
            ))
          ) : (
            <Link to="/branches">
              <strong>Find a branch</strong>
              <span>Locations across the Philippines</span>
              <em>
                <ArrowUpRight aria-hidden="true" />
              </em>
            </Link>
          )}
        </div>

        <div className="sf-contact">
          <h3 className="sf-label">Talk to Hakum</h3>
          <a href="tel:+639156296096">
            <Phone aria-hidden="true" />
            0915 629 6096
          </a>
          <a href="mailto:sales@hakumautocare.com">
            <Mail aria-hidden="true" />
            sales@hakumautocare.com
          </a>
          <a href="mailto:admin@hakumautocare.com">
            <Mail aria-hidden="true" />
            admin@hakumautocare.com
          </a>
          <p className="sf-quiet">
            <Link to="/contact">Contact form</Link>
            <span aria-hidden="true"> · </span>
            <Link to="/partnerships">Brand collabs</Link>
            <span aria-hidden="true"> · </span>
            {referral.enabled ? (
              <>
                <Link to="/refer">Refer a friend</Link>
                <span aria-hidden="true"> · </span>
              </>
            ) : null}
            <Link to="/complaints">Complaints</Link>
          </p>
        </div>
      </div>

      <div className="sf-legal">
        <div className="sf-shell sf-legal-in">
          <nav aria-label="Legal and privacy">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/cookies">Cookies</Link>
            <CookiePreferencesButton />
          </nav>
          <span>© {new Date().getFullYear()} Hakum Auto Care</span>
        </div>
      </div>
    </footer>
  )
}
