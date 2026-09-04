import { Bell, CalendarPlus, Clock3, MapPin, ShieldCheck, Star } from 'lucide-react'
import { Link } from 'react-router-dom'

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
            Book your next visit, see the live queue, follow your car through every stage, and earn
            membership points—all from one place.
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

        <div className="bd-app-device-wrap bd-reveal" aria-label="Preview of the Hakum customer app">
          <div className="bd-app-device">
            <div className="bd-app-speaker" aria-hidden="true" />
            <div className="bd-app-screen">
              <div className="bd-app-topbar">
                <div>
                  <span>Hakum Auto Care</span>
                  <strong>Hi, Jamie</strong>
                </div>
                <Bell size={18} aria-hidden="true" />
              </div>

              <div className="bd-app-ticket">
                <div className="bd-app-ticket-head">
                  <span><i aria-hidden="true" /> Live service</span>
                  <strong>Q-12</strong>
                </div>
                <h3>ABC 1234</h3>
                <p>Premium wash · Bacoor</p>
                <div className="bd-app-progress" aria-hidden="true"><span /></div>
                <div className="bd-app-status">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span><b>In progress</b>Finishing touches underway</span>
                </div>
              </div>

              <div className="bd-app-quick-grid">
                <div><Clock3 size={17} aria-hidden="true" /><b>4</b><span>Cars in queue</span></div>
                <div><Star size={17} aria-hidden="true" /><b>1,250</b><span>Membership rewards</span></div>
              </div>

              <div className="bd-app-next">
                <span>Next visit</span>
                <strong>Ceramic maintenance</strong>
                <small><MapPin size={13} aria-hidden="true" /> Bacoor · Sep 12</small>
              </div>

              <div className="bd-app-book">
                <CalendarPlus size={17} aria-hidden="true" /> Book a service
              </div>
            </div>
          </div>
          <p>Live queue · Membership rewards · Booking history</p>
        </div>
      </div>
    </section>
  )
}
