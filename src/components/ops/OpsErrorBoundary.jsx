import { Component } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'

/**
 * Operations-scoped error boundary so crashes inside /operations/* keep the team member
 * inside Operations recovery chrome instead of stranding them on the public `/` landing page.
 */
export default class OpsErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[hakum-ops] route render error', error, info?.componentStack)
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
      const homeTo = this.props.homeTo || '/operations'
      return (
        <section className="mx-auto my-8 max-w-lg rounded-3xl border border-border bg-card p-6 text-center text-card-foreground shadow-sm sm:p-8">
          <p className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase">Hakum Ops</p>
          <AlertTriangle className="mx-auto mt-4 text-amber-600 dark:text-amber-300" size={38} aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">This screen hit an error</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something unexpected broke while rendering this operations view. Retry the view, reload the app, or head back to your home screen.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <RotateCcw size={16} aria-hidden />
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem('hakum-chunk-boundary-reload')
                } catch {
                  /* private mode */
                }
                window.location.reload()
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
            >
              <RefreshCw size={16} aria-hidden />
              Reload app
            </button>
            <Link
              to={homeTo}
              onClick={() => this.setState({ hasError: false })}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground no-underline hover:bg-muted"
            >
              Back to Ops home
            </Link>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}
