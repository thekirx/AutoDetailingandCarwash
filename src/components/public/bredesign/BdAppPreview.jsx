import { Bell, CalendarDays, Home, LogOut, Newspaper, Radio, Settings, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * A miniature of the real customer app, not an idealised one.
 *
 * The earlier version led on a car mid-wash with a progress bar. That is the
 * app's rarest state — a signed-in customer with nothing booked sees "No active
 * visit", which is what most people opening it will get. It also showed
 * membership as a single points figure and left out the stamp card entirely,
 * which is the most distinctive screen in the app and the reason to install it.
 *
 * So the frame carries what the app actually leads with: the greeting and its
 * three controls, the live branch counts, and the rewards card. The bottom tab
 * bar is included because it is what makes a phone frame read as an app rather
 * than a web page inside a phone outline.
 *
 * Figures are illustrative and deliberately neutral — the real screens carry
 * test plates like QA364BA, which have no business on a marketing page. The
 * note under the frame says so on the page, not only here.
 */

const QUEUE = [
  { label: 'Waiting', value: 3 },
  { label: 'In wash', value: 2 },
  { label: 'Checking', value: 1 },
  { label: 'On floor', value: 6 },
]

const STAMPS_EARNED = 6
const STAMPS_TOTAL = 10

export default function BdAppPreview() {
  return (
    <section className="bd-app-preview" id="app-preview">
      <div className="bd-shell bd-app-preview-in">
        <div className="bd-app-copy bd-reveal">
          <p className="bd-eyebrow">Hakum in your pocket</p>
          <h2 className="bd-skew">
            Your car.
            <br />
            <em>In your hands.</em>
          </h2>
          <p>
            See which branch is busy before you drive over, follow your car through every stage, and
            collect a stamp on every visit—all from one place.
          </p>
          <div className="bd-cta-row bd-app-actions">
            <Link className="bd-btn bd-btn-primary" to="/app">
              Get our app now
            </Link>
            <Link className="bd-btn bd-btn-quiet" to="/signin">
              Sign in
            </Link>
          </div>
        </div>

        <div className="bd-app-device-wrap bd-reveal">
          {/* The frame is a picture of an interface. It is hidden from assistive
              tech and summarised in one line below, rather than walking a reader
              through decorative controls that do nothing. */}
          <div className="bd-app-device" aria-hidden="true">
            <div className="bd-app-speaker" />
            <div className="bd-app-screen">
              <div className="bd-app-topbar">
                <div>
                  <span>Hakum Auto Care</span>
                  <strong>Hi, there</strong>
                </div>
                <div className="bd-app-controls">
                  <i><Settings size={13} /></i>
                  <i className="has-badge"><Bell size={13} /><b>3</b></i>
                  <i><LogOut size={13} /></i>
                </div>
              </div>

              <div className="bd-app-branch">
                <div className="bd-app-branch-head">
                  <span>This branch</span>
                  <strong>Bacoor</strong>
                </div>
                <div className="bd-app-queue">
                  {QUEUE.map((q) => (
                    <div key={q.label}>
                      <b>{q.value}</b>
                      <span>{q.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bd-app-rewards">
                <p className="bd-app-rewards-kicker">
                  <Sparkles size={11} /> Hakum rewards
                </p>
                <strong>4 stamps from a free wash</strong>
                <div className="bd-app-stamps">
                  {Array.from({ length: STAMPS_TOTAL }, (_, i) => (
                    <span key={i} className={i < STAMPS_EARNED ? 'is-filled' : undefined}>
                      {i < STAMPS_EARNED ? 'H' : i + 1}
                    </span>
                  ))}
                </div>
                <small>
                  {STAMPS_EARNED} / {STAMPS_TOTAL}
                </small>
              </div>

              <div className="bd-app-tabs">
                <span className="is-active">
                  <Home size={13} />
                  Home
                </span>
                <span>
                  <Newspaper size={13} />
                  Blog
                </span>
                <span>
                  <CalendarDays size={13} />
                  Events
                </span>
                <span>
                  <Radio size={13} />
                  Queue
                </span>
              </div>
            </div>
          </div>
          <p>Live branch status · Stamp rewards · Booking history</p>
          <p className="bd-app-note">Illustrative figures</p>
        </div>
      </div>
    </section>
  )
}
