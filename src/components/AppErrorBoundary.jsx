import { Component } from 'react'
import { Link } from 'react-router-dom'

/** Soft UI error shell when a route render throws. */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[hakum] render error', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="legal-page not-found-page">
          <div className="public-shell legal-inner">
            <p className="eyebrow">Error</p>
            <h1 className="section-title">
              Something
              <br />
              <i>stalled.</i>
            </h1>
            <p className="legal-updated">The page hit an unexpected error. Try again or head home.</p>
            <div className="not-found-actions">
              <button type="button" className="button button-blue" onClick={() => window.location.assign('/')}>
                Back home
              </button>
              <Link className="dark-link" to="/contact">
                Contact
              </Link>
              <Link className="dark-link" to="/book">
                Book a service
              </Link>
            </div>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}
