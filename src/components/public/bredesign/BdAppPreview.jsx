import { Bell, CalendarDays, CalendarPlus, Home, MoreHorizontal, Newspaper, Plus, Radio } from 'lucide-react'
import { Link } from 'react-router-dom'

/* Device frame from the "iPhone 15 / 15 Pro Device Frames" Figma Community
   file, exported at 1x with the screen subtracted. It is an overlay: the app
   content below is live DOM showing through the cut-out, not a screenshot
   pasted into a picture of a phone. */
const DEVICE_FRAME = new URL('../../../assets/device/iphone-15-pro-white-titanium.svg', import.meta.url).href

/**
 * Decorative miniature of CustomerAccountPage's mobile dashboard. Static
 * sample content keeps this public preview independent of customer sessions
 * and portal availability. Keep its card order and dock aligned with the app.
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
            HAKUM Customer
            <br />
            <em>Mobile App</em>
          </h2>
          <p className="bd-app-tagline">Taking care of your car never gets this exciting!</p>
          <p>
            Your Hakum experience, all in one app. Check live branch queues, track your loyalty
            stamps and free services, find locations near you, and get real-time notifications —
            because your time matters as much as your car.
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
            <div className="bd-app-screen bd-app-dashboard">
              <div className="bd-preview-hero">
                <div className="bd-preview-brandbar">
                  <img src="/branding/hakum-lw-ow.png" alt="" />
                  <div className="bd-preview-controls">
                    <span><Bell size={17} /></span>
                    <span>AC</span>
                  </div>
                </div>
                <p>Good morning,</p>
                <small>26° Partly cloudy</small>
                <strong>ALEX</strong>
                <p className="bd-preview-sub">Your car deserves a great day too.</p>
              </div>

              <div className="bd-preview-content">
                <div className="bd-preview-visit">
                  <strong>No active visit</strong>
                  <p>Book a service to track your car on the floor.</p>
                  <div className="bd-preview-actions">
                    <span><CalendarPlus size={12} />Book a service</span>
                    <span><Plus size={12} />Add a car</span>
                  </div>
                </div>
                <div className="bd-preview-quick">
                  <div><Plus size={19} /><span><strong>Add a car</strong><small>Save a plate</small></span></div>
                  <div><CalendarDays size={19} /><span><strong>Events</strong><small>Meets and promos</small></span></div>
                </div>
                <div className="bd-preview-loyalty">
                  <div className="bd-preview-loyalty-head">
                    <span className="bd-preview-ring">6/10</span>
                    <div><small>LOYALTY</small><strong>Loyalty program</strong><p>6/10 stamps</p></div>
                  </div>
                  <div className="bd-preview-stamps">
                    {Array.from({ length: STAMPS_TOTAL }, (_, i) => (
                      <span key={i} className={i < STAMPS_EARNED ? 'is-filled' : undefined}>
                        {i < STAMPS_EARNED ? 'H' : i + 1}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bd-preview-queue">
                  <div><strong>Live queue</strong><span>Bacoor</span></div>
                  <div className="bd-preview-counts">
                    {QUEUE.map((q) => <span key={q.label}><b>{q.value}</b><small>{q.label}</small></span>)}
                  </div>
                </div>
              </div>

              <div className="bd-app-tabs bd-preview-dock">
                <span className="is-active">
                  <Home size={13} />
                  Home
                </span>
                <span>
                  <CalendarPlus size={13} />
                  Book
                </span>
                <span>
                  <Radio size={13} />
                  Queue
                </span>
                <span>
                  <Newspaper size={13} />
                  Blog
                </span>
                <span>
                  <MoreHorizontal size={13} />
                  More
                </span>
              </div>
            </div>
            <img className="bd-app-frame" src={DEVICE_FRAME} alt="" draggable="false" />
          </div>
          <p>Live branch status · Stamp rewards · Booking history</p>
          <p className="bd-app-note">Illustrative figures</p>
        </div>
      </div>
    </section>
  )
}
