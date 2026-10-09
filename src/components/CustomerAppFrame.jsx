import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { Link, useLocation, useNavigationType } from 'react-router-dom'
import CustomerAccountDock from '@/components/CustomerAccountDock'
import { customerScreenDepth } from '@/lib/customerAccountNav'
import { useCustomerAppTheme } from '@/lib/customerAppTheme'
import '@/styles/customer-refinement.css'
import '@/styles/customer-native.css'

/* Remembered across screens so the next one knows whether it was pushed, popped or switched to. */
let lastDepth = null

function enterKind(depth, navType) {
  const prev = lastDepth
  if (prev == null) return 'none'
  if (depth > prev) return 'push'
  if (depth < prev || (navType === 'POP' && depth > 0)) return 'pop'
  return 'tab'
}

/** Solid compact bar once the large title has scrolled away. */
function useScrolledPast(px) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const on = () => setPast(window.scrollY > px)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [px])
  return past
}

/** Pull down at the top of the page to call `onRefresh` (touch only; desktop keeps its buttons). */
function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const start = useRef(null)
  const pullRef = useRef(0)
  useEffect(() => {
    if (!onRefresh) return undefined
    const down = (e) => {
      start.current = window.scrollY <= 0 && !busy ? e.touches[0].clientY : null
    }
    const move = (e) => {
      if (start.current == null) return
      const d = Math.max(0, Math.min(110, e.touches[0].clientY - start.current))
      pullRef.current = d
      setPull(d)
    }
    const up = async () => {
      if (start.current == null) return
      start.current = null
      const d = pullRef.current
      pullRef.current = 0
      setPull(0)
      if (d < 70) return
      setBusy(true)
      try {
        await onRefresh()
      } finally {
        setBusy(false)
      }
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
  }, [onRefresh, busy])
  return { pull, busy }
}

/**
 * Customer account chrome.
 * Phone / PWA: the website's navy (or light paper, chosen in Me), a large title
 * that hands over to a frosted compact bar on scroll, screens that slide in
 * when pushed, and the floating dock.
 * Desktop web: content sits under the landing-page header (PublicLayout); dock becomes a tab row.
 * `cols` opts the scroll area into a 2-column grid on wide screens (children add `capp-span` to go full width).
 */
export default function CustomerAppFrame({
  title,
  subtitle,
  navTitle,
  backTo,
  backLabel = 'Back',
  onBack,
  actions,
  hero,
  onRefresh,
  cols = false,
  className = '',
  children,
}) {
  const [theme] = useCustomerAppTheme()
  const location = useLocation()
  const navType = useNavigationType()
  const depth = customerScreenDepth(location.pathname, location.search)
  const [enter, setEnter] = useState(() => enterKind(depth, navType))
  const solid = useScrolledPast(hero ? 220 : 64)
  const { pull, busy } = usePullToRefresh(onRefresh)
  const showTop = Boolean(title || backTo || onBack || actions)
  const hasBack = Boolean(onBack || backTo)
  const barTitle = navTitle || (typeof title === 'string' ? title : '')

  /* Same page component, different screen (Me → My cars): replay the transition.
     Keyed on path + depth so a query change on one screen (Queue's branch) doesn't. */
  const screenKey = `${location.pathname}#${depth}`
  const lastScreen = useRef(screenKey)
  useEffect(() => {
    if (lastScreen.current !== screenKey) {
      lastScreen.current = screenKey
      const kind = enterKind(depth, navType)
      setEnter('none')
      const id = requestAnimationFrame(() => setEnter(kind))
      lastDepth = depth
      return () => cancelAnimationFrame(id)
    }
    lastDepth = depth
    return undefined
  }, [screenKey, depth, navType])

  const back = onBack ? (
    <button type="button" className="capp-back" onClick={onBack} aria-label="Back">
      <ChevronLeft size={22} strokeWidth={2} aria-hidden />
    </button>
  ) : backTo ? (
    <Link className="capp-back" to={backTo} aria-label="Back">
      <ChevronLeft size={22} strokeWidth={2} aria-hidden />
    </Link>
  ) : null

  return (
    <div className={`capp ${className}`.trim()} data-app-theme={theme}>
      <div className={`capp-stage capp-enter-${enter}`}>
        <div className={`capp-navbar${solid ? ' is-solid' : ''}${hero ? ' is-over-photo' : ''}`} aria-hidden={!solid}>
          <span className="capp-navbar-side">
            {onBack ? (
              <button type="button" className="capp-navbar-back" onClick={onBack} tabIndex={solid ? 0 : -1}>
                <ChevronLeft size={24} strokeWidth={2} aria-hidden />
                {backLabel}
              </button>
            ) : backTo ? (
              <Link className="capp-navbar-back" to={backTo} tabIndex={solid ? 0 : -1}>
                <ChevronLeft size={24} strokeWidth={2} aria-hidden />
                {backLabel}
              </Link>
            ) : null}
          </span>
          <span className="capp-navbar-title">{barTitle}</span>
          <span className="capp-navbar-side is-end">{solid ? actions : null}</span>
        </div>
        {onRefresh ? (
          <div className={`capp-ptr${busy ? ' is-busy' : ''}`} style={{ height: busy ? 44 : pull * 0.6 }} aria-hidden={!busy}>
            <RefreshCw size={20} strokeWidth={2} style={{ transform: `rotate(${pull * 3}deg)` }} aria-hidden />
          </div>
        ) : null}
        {hero || null}
        {showTop ? (
          <header className={`capp-top${hasBack ? ' has-back' : ' is-root'}`}>
            {back}
            <div className={`capp-top-copy${hasBack ? '' : ' is-plain'}`}>
              {title ? <h1>{title}</h1> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {actions ? <div className="capp-top-actions">{actions}</div> : null}
          </header>
        ) : null}
        <div className={`capp-scroll${cols ? ' is-cols' : ''}`}>{children}</div>
        <CustomerAccountDock />
      </div>
    </div>
  )
}
