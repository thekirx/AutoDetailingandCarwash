import { Link } from 'react-router-dom'

import BdAppGuide from './BdAppGuide'

/* Device frame from the "iPhone 15 / 15 Pro Device Frames" Figma Community
   file, exported at 1x with the screen subtracted. It is an overlay: the app
   screen shows through the cut-out. */
const DEVICE_FRAME = new URL('../../../assets/device/iphone-15-pro-white-titanium.svg', import.meta.url).href

/* A real capture of the customer app's home screen with sample data (Alex, no
   visit booked), so the picture always shows the app as it actually looks.
   Re-capture it when the home screen changes. */
const APP_HOME = new URL('../../../assets/app-guide/home.webp', import.meta.url).href

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
            <BdAppGuide className="bd-btn bd-btn-primary">Get our app now</BdAppGuide>
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
            <div className="bd-app-screen bd-app-shot">
              <img src={APP_HOME} alt="" />
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
