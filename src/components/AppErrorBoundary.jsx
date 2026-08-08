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
    const message = String(error?.message || error || '')
    const chunkMiss =
      /Failed to fetch dynamically imported module/i.test(message) ||
      /Loading chunk [\d]+ failed/i.test(message) ||
      /Importing a module script failed/i.test(message)
    if (!chunkMiss) return
    try {
      if (sessionStorage.getItem('hakum-chunk-boundary-reload') === '1') return
      sessionStorage.setItem('hakum-chunk-boundary-reload', '1')
      window.location.reload()
    } catch {
      /* private mode */
    }
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
              <button
                type="button"
                className="button button-blue"
                onClick={() => {
                  try {
                    sessionStorage.removeItem('hakum-chunk-boundary-reload')
                  } catch {
                    /* private mode */
                  }
                  window.location.reload()
                }}
              >
                Reload
              </button>
              <button type="button" className="dark-link" onClick={() => window.location.assign('/')}>
                Back home
              </button>
              <Link className="dark-link" to="/contact">
                Contact
              </Link>
            </div>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}
