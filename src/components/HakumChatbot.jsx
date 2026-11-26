import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Gift,
  GripVertical,
  LayoutGrid,
  LocateFixed,
  MapPin,
  MessageCircle,
  RotateCcw,
  Shield,
  Sparkles,
  Sun,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { CHATBOT_DEFAULT_SUGGESTIONS, CHATBOT_MAIN_MENU } from '../data/hakumChatbotKnowledge.js'
import {
  CHATBOT_ACCENT_PRESETS,
  DEFAULT_CHATBOT_SETTINGS,
  HAKUM_FACEBOOK_MESSENGER_URL,
  HAKUM_FACEBOOK_PAGE_URL,
} from '../lib/chatbotSettingsRules.js'
import { resolveHakumChatbotReply } from '../lib/hakumChatbotEngine.js'
import { fetchChatbotCustomerSummary, fetchChatbotLiveCatalog } from '../lib/hakumChatbotLiveCatalog.js'
import './HakumChatbot.css'

const POS_STORAGE_KEY = 'hakum.chatbotPos.v1'
const DRAG_THRESHOLD_PX = 6

const MENU_ICONS = {
  sparkles: Sparkles,
  shield: Shield,
  sun: Sun,
  calendar: Calendar,
  gift: Gift,
  mappin: MapPin,
}

const SIZE_TABS = [
  { id: 'small', short: 'S', label: 'Sedan / Hatch' },
  { id: 'medium', short: 'M', label: 'Crossover' },
  { id: 'large', short: 'L', label: 'SUV / Pickup' },
  { id: 'extra_large', short: 'XL', label: 'Van / MPV' },
]

function loadSavedOffset() {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY)
    if (!raw) return { x: 0, y: 0, custom: false }
    const parsed = JSON.parse(raw)
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
      return { x: parsed.x, y: parsed.y, custom: Boolean(parsed.x !== 0 || parsed.y !== 0) }
    }
  } catch {
    // Ignore storage read errors
  }
  return { x: 0, y: 0, custom: false }
}

function saveOffset(offset) {
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify({ x: Math.round(offset.x), y: Math.round(offset.y) }))
  } catch {
    // Ignore storage quota errors
  }
}

function clampOffset(nextX, nextY, el) {
  if (typeof window === 'undefined' || !el) return { x: nextX, y: nextY }
  const margin = 12
  const rect = el.getBoundingClientRect()
  const prevTransform = el.style.transform
  const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(prevTransform || '')
  const curX = match ? Number(match[1]) : 0
  const curY = match ? Number(match[2]) : 0
  const naturalLeft = rect.left - curX
  const naturalRight = rect.right - curX
  const naturalTop = rect.top - curY
  const naturalBottom = rect.bottom - curY

  const minX = margin - naturalLeft
  const maxX = window.innerWidth - margin - naturalRight
  const minY = margin - naturalTop
  const maxY = window.innerHeight - margin - naturalBottom

  return {
    x: Math.min(Math.max(nextX, Math.min(minX, maxX)), Math.max(minX, maxX)),
    y: Math.min(Math.max(nextY, Math.min(minY, maxY)), Math.max(minY, maxY)),
  }
}

function createWelcomeMessage(settings) {
  const promoCard =
    settings.promo_enabled !== false
      ? {
          eyebrow: settings.promo_eyebrow || DEFAULT_CHATBOT_SETTINGS.promo_eyebrow,
          title: settings.promo_title || DEFAULT_CHATBOT_SETTINGS.promo_title,
          description: settings.promo_description || DEFAULT_CHATBOT_SETTINGS.promo_description,
          ctaLabel: settings.promo_cta_label || DEFAULT_CHATBOT_SETTINGS.promo_cta_label,
          ctaPath: settings.promo_cta_path || DEFAULT_CHATBOT_SETTINGS.promo_cta_path,
        }
      : null

  return {
    id: 'welcome',
    role: 'bot',
    title: settings.welcome_title || DEFAULT_CHATBOT_SETTINGS.welcome_title,
    badge: 'Main Menu',
    paragraphs: [settings.welcome_message || DEFAULT_CHATBOT_SETTINGS.welcome_message],
    showMainMenu: true,
    promoCard,
    specs: [],
    highlights: [],
    actions: [],
    suggestions:
      Array.isArray(settings.suggested_prompts) && settings.suggested_prompts.length
        ? settings.suggested_prompts
        : CHATBOT_DEFAULT_SUGGESTIONS,
  }
}

export default function HakumChatbot({ settings }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const isCustomer = Boolean(user && profile?.role === 'customer')

  const [open, setOpen] = useState(false)
  const [tooltipDismissed, setTooltipDismissed] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => [createWelcomeMessage(settings)])
  const [catalog, setCatalog] = useState(null)
  const [portal, setPortal] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState(() => loadSavedOffset())
  const [tooltipOnRight, setTooltipOnRight] = useState(false)
  const [activeSizesByMsg, setActiveSizesByMsg] = useState({})
  const [viewportHeight, setViewportHeight] = useState(null)

  const rootRef = useRef(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const dragStateRef = useRef(null)
  const suppressClickRef = useRef(false)

  const hasFloatingTalkFab =
    pathname.startsWith('/services/') || pathname.startsWith('/tint-finder')
  const isAccountRoute = pathname.startsWith('/account')

  const accentId = Object.prototype.hasOwnProperty.call(
    CHATBOT_ACCENT_PRESETS,
    settings.accent_preset,
  )
    ? settings.accent_preset
    : 'sapphire'

  const handoffEnabled = settings.human_handoff_enabled !== false
  const messengerUrl = settings.messenger_url || HAKUM_FACEBOOK_MESSENGER_URL
  const facebookUrl = settings.facebook_url || HAKUM_FACEBOOK_PAGE_URL
  const humanCtaLabel = settings.human_cta_label || DEFAULT_CHATBOT_SETTINGS.human_cta_label

  // Sync welcome greeting, promo spotlight, and suggested prompts live when Owner saves Settings
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === 'welcome' ? createWelcomeMessage(settings) : m)),
    )
  }, [settings])

  const hydrateContext = useCallback(async () => {
    const [liveCat, livePortal] = await Promise.all([
      fetchChatbotLiveCatalog(),
      fetchChatbotCustomerSummary({ isCustomer }),
    ])
    setCatalog(liveCat)
    if (livePortal) setPortal(livePortal)
    return { catalog: liveCat, portal: livePortal, settings }
  }, [isCustomer, settings])

  useEffect(() => {
    if (open) {
      hydrateContext()
    }
  }, [open, hydrateContext])

  useEffect(() => {
    const applyClamp = () => {
      const el = rootRef.current
      if (!el) return
      setOffset((prev) => {
        const clamped = clampOffset(prev.x, prev.y, el)
        const rect = el.getBoundingClientRect()
        setTooltipOnRight(rect.left + (clamped.x - prev.x) < window.innerWidth * 0.42)
        if (clamped.x === prev.x && clamped.y === prev.y) return prev
        return { ...prev, ...clamped }
      })
    }
    const raf = requestAnimationFrame(applyClamp)
    window.addEventListener('resize', applyClamp)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', applyClamp)
    }
  }, [open, pathname])

  useEffect(() => {
    if (!open || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, open])

  useEffect(() => {
    if (!open) {
      setViewportHeight(null)
      return undefined
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const syncViewport = () => {
      const vv = window.visualViewport
      if (vv && window.innerWidth <= 640) {
        setViewportHeight(Math.round(vv.height))
      } else {
        setViewportHeight(null)
      }
    }
    syncViewport()
    window.addEventListener('keydown', onKey)
    window.visualViewport?.addEventListener('resize', syncViewport)
    window.visualViewport?.addEventListener('scroll', syncViewport)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.visualViewport?.removeEventListener('resize', syncViewport)
      window.visualViewport?.removeEventListener('scroll', syncViewport)
    }
  }, [open])

  const beginDrag = useCallback(
    (e) => {
      if (e.button != null && e.button !== 0) return
      if (open && typeof window !== 'undefined' && window.innerWidth <= 640) return
      if (e.target.closest('button[data-no-drag="true"], a[data-no-drag="true"]')) return
      const el = rootRef.current
      if (!el) return
      suppressClickRef.current = false
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: offset.x,
        originY: offset.y,
        moved: false,
      }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    [offset.x, offset.y, open],
  )

  useEffect(() => {
    const onMove = (e) => {
      const ds = dragStateRef.current
      if (!ds || e.pointerId !== ds.pointerId) return
      const dx = e.clientX - ds.startX
      const dy = e.clientY - ds.startY
      if (!ds.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      ds.moved = true
      suppressClickRef.current = true
      setDragging(true)
      const clamped = clampOffset(ds.originX + dx, ds.originY + dy, rootRef.current)
      setOffset({ x: clamped.x, y: clamped.y, custom: true })
    }

    const onEnd = (e) => {
      const ds = dragStateRef.current
      if (!ds || e.pointerId !== ds.pointerId) return
      dragStateRef.current = null
      setDragging(false)
      if (ds.moved) {
        setOffset((cur) => {
          saveOffset(cur)
          return cur
        })
        const rect = rootRef.current?.getBoundingClientRect()
        if (rect) setTooltipOnRight(rect.left < window.innerWidth * 0.42)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
  }, [])

  const submitQuery = useCallback(
    async (text) => {
      const clean = String(text || '').trim()
      if (!clean) return
      setInput('')

      const ctx = catalog ? { catalog, portal, settings } : await hydrateContext()
      const reply = resolveHakumChatbotReply(clean, ctx)
      const stamp = Date.now()
      const botId = `b-${stamp}`

      if (reply.sizePricing?.selectedSize) {
        setActiveSizesByMsg((prev) => ({ ...prev, [botId]: reply.sizePricing.selectedSize }))
      }

      setMessages((prev) => [
        ...prev,
        { id: `u-${stamp}`, role: 'user', text: clean },
        { id: botId, role: 'bot', ...reply },
      ])
    },
    [catalog, portal, settings, hydrateContext],
  )

  function handleFormSubmit(e) {
    e.preventDefault()
    submitQuery(input)
  }

  function handleOpenMenuCard() {
    submitQuery('main menu')
  }

  function handleResetConversation() {
    setMessages([createWelcomeMessage(settings)])
    setActiveSizesByMsg({})
    setInput('')
    inputRef.current?.focus()
  }

  function handleResetPosition() {
    const zero = { x: 0, y: 0, custom: false }
    setOffset(zero)
    saveOffset(zero)
    setTooltipOnRight(false)
  }

  function handleRouteJump(to, state) {
    if (!to) return
    navigate(to, state ? { state } : undefined)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpen(false)
    }
  }

  const latestSuggestions = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'bot' && Array.isArray(messages[i].suggestions) && messages[i].suggestions.length) {
        return messages[i].suggestions
      }
    }
    return Array.isArray(settings.suggested_prompts) && settings.suggested_prompts.length
      ? settings.suggested_prompts
      : CHATBOT_DEFAULT_SUGGESTIONS
  }, [messages, settings.suggested_prompts])

  return (
    <>
      {open ? (
        <div
          className="hakum-bot-scrim"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        ref={rootRef}
        aria-label="Hakum Concierge Assistant"
        data-accent={accentId}
        className={[
          'hakum-bot-root',
          open ? 'is-open' : '',
          dragging ? 'is-dragging' : '',
          offset.custom ? 'is-custom-pos' : '',
          hasFloatingTalkFab ? 'is-raised-above-fab' : '',
          isAccountRoute ? 'is-account-route' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          transform: open && typeof window !== 'undefined' && window.innerWidth <= 640
            ? undefined
            : `translate3d(${offset.x}px, ${offset.y}px, 0)`,
          ...(viewportHeight ? { '--hb-viewport-h': `${viewportHeight}px` } : {}),
        }}
      >
      {!open ? (
        <div className={`hakum-bot-launcher-wrap${tooltipOnRight ? ' is-tooltip-right' : ''}`}>
          {!tooltipDismissed && settings.launcher_label ? (
            <div
              className="hakum-bot-tooltip"
              role="button"
              tabIndex={0}
              onClick={() => setOpen(true)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(true)}
            >
              <span>{settings.launcher_label}</span>
              <button
                type="button"
                className="hakum-bot-tooltip-dismiss"
                aria-label="Dismiss launcher hint"
                onClick={(e) => {
                  e.stopPropagation()
                  setTooltipDismissed(true)
                }}
              >
                <X size={11} aria-hidden />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="hakum-bot-launcher"
            aria-label="Open Hakum Concierge chatbot (drag to move)"
            aria-expanded={false}
            onPointerDown={beginDrag}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false
                return
              }
              setOpen(true)
            }}
          >
            <span className="hakum-bot-pip hakum-bot-pip--top" aria-hidden />
            <span className="hakum-bot-pip hakum-bot-pip--bottom" aria-hidden />
            <span className="hakum-bot-pip hakum-bot-pip--left" aria-hidden />
            <span className="hakum-bot-pip hakum-bot-pip--right" aria-hidden />
            <span className="hakum-bot-launcher-core">
              <img
                src="/branding/hakum-mark-ow.png"
                alt="Hakum Auto Care"
                className="hakum-bot-launcher-logo"
                width={32}
                height={32}
                draggable={false}
              />
            </span>
            <span className="hakum-bot-status-badge" aria-hidden />
          </button>
        </div>
      ) : (
        <section className="hakum-bot-panel-shell" role="dialog" aria-label="Hakum Auto Care Concierge">
          <div className="hakum-bot-panel">
            <header
              className="hakum-bot-head"
              title="Drag header to reposition anywhere on screen"
              onPointerDown={beginDrag}
            >
              <div className="hakum-bot-head-id">
                <GripVertical size={15} className="hakum-bot-grip" aria-hidden />
                <span className="hakum-bot-head-badge" aria-hidden>
                  <img src="/branding/hakum-mark-ow.png" alt="" width={20} height={20} draggable={false} />
                </span>
                <div className="hakum-bot-head-meta">
                  <h2 className="hakum-bot-title">{settings.welcome_title || 'Hakum Concierge'}</h2>
                  <div className="hakum-bot-sub">
                    <span className="hakum-bot-dot" aria-hidden />
                    <span>Instant answers · Live catalog</span>
                  </div>
                </div>
              </div>

              <div className="hakum-bot-head-actions">
                {handoffEnabled ? (
                  <a
                    data-no-drag="true"
                    href={messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hakum-bot-icon-btn"
                    title="Talk to a real person on Messenger"
                    aria-label="Talk to a real person on Messenger"
                  >
                    <MessageCircle size={16} aria-hidden />
                  </a>
                ) : null}
                <button
                  type="button"
                  data-no-drag="true"
                  className="hakum-bot-icon-btn"
                  title="Main Menu"
                  aria-label="Open Main Menu"
                  onClick={handleOpenMenuCard}
                >
                  <LayoutGrid size={16} aria-hidden />
                </button>
                {offset.custom ? (
                  <button
                    type="button"
                    data-no-drag="true"
                    className="hakum-bot-icon-btn"
                    title="Reset window position"
                    aria-label="Reset window position to corner"
                    onClick={handleResetPosition}
                  >
                    <LocateFixed size={16} aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  data-no-drag="true"
                  className="hakum-bot-icon-btn"
                  title="Reset conversation"
                  aria-label="Reset conversation"
                  onClick={handleResetConversation}
                >
                  <RotateCcw size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  data-no-drag="true"
                  className="hakum-bot-icon-btn"
                  title="Minimize"
                  aria-label="Minimize Hakum Concierge"
                  onClick={() => setOpen(false)}
                >
                  <X size={17} aria-hidden />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="hakum-bot-scroll" role="log" aria-live="polite">
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="hakum-bot-msg is-user">
                      <div className="hakum-bot-user-bubble">{msg.text}</div>
                    </div>
                  )
                }

                const sizeMap = msg.sizePricing?.rowsBySize || null
                const selectedSizeSlug = activeSizesByMsg[msg.id] || msg.sizePricing?.selectedSize || 'medium'
                const activeSpecs = sizeMap ? sizeMap[selectedSizeSlug] || msg.specs : msg.specs

                return (
                  <div key={msg.id} className="hakum-bot-msg">
                    <article className="hakum-bot-card">
                      <div className="hakum-bot-card-top">
                        <h3 className="hakum-bot-card-title">{msg.title}</h3>
                        {msg.badge ? <span className="hakum-bot-card-badge">{msg.badge}</span> : null}
                      </div>

                      {msg.paragraphs?.map((p, idx) => (
                        <p key={idx} className="hakum-bot-para">
                          {p}
                        </p>
                      ))}

                      {msg.promoCard ? (
                        <div className="hakum-bot-promo">
                          <div className="hakum-bot-promo-head">
                            <span className="hakum-bot-promo-eyebrow">{msg.promoCard.eyebrow}</span>
                            <button
                              type="button"
                              className="hakum-bot-promo-ask"
                              onClick={() => submitQuery(msg.promoCard.title)}
                            >
                              Compare
                            </button>
                          </div>
                          <strong className="hakum-bot-promo-title">{msg.promoCard.title}</strong>
                          <p className="hakum-bot-promo-desc">{msg.promoCard.description}</p>
                          <button
                            type="button"
                            className="hakum-bot-cta hakum-bot-cta--primary"
                            onClick={() => handleRouteJump(msg.promoCard.ctaPath)}
                          >
                            <span>{msg.promoCard.ctaLabel}</span>
                            <ArrowRight size={14} aria-hidden />
                          </button>
                        </div>
                      ) : null}

                      {sizeMap ? (
                        <div className="hakum-bot-size-picker" role="group" aria-label="Select vehicle size for pricing">
                          {SIZE_TABS.map((sz) => {
                            const active = selectedSizeSlug === sz.id
                            return (
                              <button
                                key={sz.id}
                                type="button"
                                aria-pressed={active}
                                className={`hakum-bot-size-btn${active ? ' is-active' : ''}`}
                                onClick={() => setActiveSizesByMsg((prev) => ({ ...prev, [msg.id]: sz.id }))}
                              >
                                <strong>{sz.short}</strong>
                                <span>{sz.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      {msg.showMainMenu ? (
                        <>
                          <div className="hakum-bot-menu" role="navigation" aria-label="Concierge Main Menu">
                            {CHATBOT_MAIN_MENU.map((item) => {
                              const Icon = MENU_ICONS[item.icon] || Sparkles
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="hakum-bot-menu-btn"
                                  onClick={() => submitQuery(item.prompt)}
                                >
                                  <span className="hakum-bot-menu-icon" aria-hidden>
                                    <Icon size={15} strokeWidth={2} />
                                  </span>
                                  <span className="hakum-bot-menu-text">
                                    <strong>{item.label}</strong>
                                    <span>{item.sub}</span>
                                  </span>
                                </button>
                              )
                            })}
                          </div>

                          {handoffEnabled ? (
                            <div className="hakum-bot-handoff-strip">
                              <span>Prefer a real person?</span>
                              <div className="hakum-bot-handoff-links">
                                <a href={messengerUrl} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle size={13} aria-hidden />
                                  <span>{humanCtaLabel}</span>
                                </a>
                                <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
                                  <span>Facebook</span>
                                  <ArrowUpRight size={13} aria-hidden />
                                </a>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {activeSpecs?.length ? (
                        <div className="hakum-bot-specs">
                          {activeSpecs.map((row, idx) => (
                            <div key={idx} className="hakum-bot-spec-row">
                              <span>{row.label}</span>
                              <strong>{row.value}</strong>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {msg.highlights?.length ? (
                        <div className="hakum-bot-highlights">
                          {msg.highlights.map((chip, idx) => (
                            <span key={idx} className="hakum-bot-chip">
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {msg.actions?.length ? (
                        <div className="hakum-bot-actions">
                          {msg.actions.map((action, idx) =>
                            action.external ? (
                              <a
                                key={idx}
                                href={action.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`hakum-bot-cta hakum-bot-cta--${action.variant || 'secondary'}`}
                              >
                                <span>{action.label}</span>
                                <ArrowUpRight size={14} aria-hidden />
                              </a>
                            ) : (
                              <button
                                key={idx}
                                type="button"
                                className={`hakum-bot-cta hakum-bot-cta--${action.variant || 'secondary'}`}
                                onClick={() => handleRouteJump(action.to, action.state)}
                              >
                                <span>{action.label}</span>
                                <ArrowRight size={14} aria-hidden />
                              </button>
                            ),
                          )}
                        </div>
                      ) : null}
                    </article>
                  </div>
                )
              })}
            </div>

            <div className="hakum-bot-suggestions-wrap">
              <div className="hakum-bot-suggestions" role="list" aria-label="Suggested questions">
                {latestSuggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="hakum-bot-suggest-pill"
                    onClick={() => submitQuery(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <form className="hakum-bot-form" onSubmit={handleFormSubmit}>
              <div className="hakum-bot-input-wrap">
                <input
                  ref={inputRef}
                  type="text"
                  className="hakum-bot-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about services, prices, branches, or queue..."
                  aria-label="Ask Hakum Concierge"
                  maxLength={180}
                />
                <button
                  type="submit"
                  className="hakum-bot-send"
                  aria-label="Send question"
                  disabled={!input.trim()}
                >
                  <ArrowUpRight size={17} aria-hidden />
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
      </aside>
    </>
  )
}
